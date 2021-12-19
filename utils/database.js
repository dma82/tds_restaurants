'use strict';

const _ = require('lodash'),
      async = require('async'),
      debug = require('debug')('TDS:DB'),
      mysql = require('mysql'),
      settings = require('../settings.json');

/*
    This class manages the connection and the transactions with the DB.

    NOTE: In a real application DB Creation should not occurr here,
    as well as data manipulation or data retrieve: better to have 
    everything already defined and wrapped in stored procedure.

    The approach used here is only for demonstration purposes
*/

module.exports = class Database {
    constructor(){
        if(!this.connection)
            this.connection = mysql.createConnection({
                host: settings.db_host,
                user: settings.db_user,
                password: settings.db_password,
                database: settings.db_schema,
                multipleStatements: true
            });
    }

    getConnection = () =>{
        return this.connection;
    }


    initialiseDB = () =>{
        this.connection.query('CREATE DATABASE IF NOT EXISTS ' + settings.db_schema, function (err, result) {
            if (err) throw err;
            debug('Database created');
        });
    }

    initialiseTables = () => {
        let sql = `CREATE TABLE IF NOT EXISTS ${settings.db_schema}.tds_restaurants (
                        restaurant_id INT AUTO_INCREMENT PRIMARY KEY,
                        restaurant_name	VARCHAR(100)
                    ) ENGINE=InnoDB DEFAULT CHARSET=latin1 AUTO_INCREMENT=1;
                    
                    CREATE TABLE IF NOT EXISTS ${settings.db_schema}.tds_schedules (
                        restaurant_id INT NOT NULL,
                        day_of_week INT NOT NULL,
                        open_at TIME NOT NULL,
                        close_at TIME NOT NULL
                    ) ENGINE=InnoDB;
                    
                    -- This view is necessary because the connector was not recognizing the subquery using the WITH statement
                    CREATE OR REPLACE VIEW ${settings.db_schema}.tds_schedules_transformed AS (
                    -- Use a dummy date to convert the day of the week when the restart is open into the first day from the dummy date, 
                    -- E.g. if the restaurant is open on day 2 (i.e. Monday), this transformation will return the first Monday after the dummy date
                    SELECT restaurant_id, day_of_week, open_at, close_at, 
                            ADDTIME(ADDDATE('2021-12-01 00:00', MOD((7 + day_of_week - DAYOFWEEK('2021-12-01')), 7)), open_at) AS opening_date,
                            CASE 
                                -- If the closing time if less than the opening time, this means the closing time is on the following day so add an extra day
                                WHEN close_at < open_at THEN ADDTIME(ADDDATE('2021-12-01 00:00', MOD((7 + day_of_week + 1- DAYOFWEEK('2021-12-01')), 7)), close_at)
                                WHEN close_at > open_at THEN ADDTIME(ADDDATE('2021-12-01 00:00', MOD((7 + day_of_week - DAYOFWEEK('2021-12-01')), 7)), close_at)
                            END AS closing_date
                    FROM tds_schedules);
                    `

        this.connection.query(sql, function (err, result) {
            if (err) throw err;
            debug("Tables created");
        });
        
    }


    checkTables = (callback) => {
        this.connection.query(`SELECT COUNT(*) total_records FROM ${settings.db_schema}.tds_restaurants`, function (err, result) {
            (err) ? callback(err, null) : callback(null, result[0].total_records);
        });
    }
    
    uploadCSV = (restaurants) => {
        _.each(restaurants, restaurant => {
            this.connection.beginTransaction(function (err) {
                if (err) {
                    throw err;
                }
            
                inserRestaurant(restaurant, function (err, result) {
                    if (err) {
                        rollback(this.connection, err);
                    }
                
                    insertSchedule(restaurant.openingDays, result.insertId, function (err, data) {
                        if (err) {
                            this.rollback(connection, err);
                        } else {
                            this.commit(this.connection);
                        }
                    });
                });
            });
        });
    }

    inserRestaurant = (restaurant, callback) => {
        let sqlRestaurants = `INSERT INTO ${settings.db_schema}.tds_restaurants (restaurant_name) VALUES (${mysql.escape(restaurant.name)})`;
        this.connection.query(sqlRestaurants, function (err, result) {
            return callback(err, result);
        });
    }

    insertSchedule = (openingDays, restaurantId, callback) => {
        async.each(openingDays, (od, asyncCallback) => {
                let sqlSchedules = `INSERT INTO ${settings.db_schema}.tds_schedules (restaurant_id, day_of_week, open_at, close_at) VALUES (${restaurantId}, 
                    ${(od.dayOfTheWeek % 7) + 1}, '${od.openingTime}', '${od.closingTime}')`;
                
                    this.connection.query(sqlSchedules, function (err, data) {
                        return asyncCallback(err, data);
                    });
            }, 
            function (err) {
                if (err) {
                    return callback(err);
                }
                return callback();
        });
    }


    rollback = (connection, err) => {
        connection.rollback(function () {
            debug("Error rollbacking transaction");
            throw err;
        });
    }
    

    commit = (connection) => {
        connection.commit(function (err) {
            if (err) {
                rollback(connection, err);
            }
            debug('Transaction committed');
        });
    }


    getOpenRestaurants = (day_of_week, open_at, callback) => {
        let sqlSearch = `SELECT DISTINCT r.restaurant_name, tmp.day_of_week, time_format(tmp.open_at, '%H:%i') AS open_at, time_format(tmp.close_at, '%H:%i') AS close_at
        FROM ${settings.db_schema}.tds_schedules_transformed tmp, ${settings.db_schema}.tds_restaurants r
        WHERE tmp.restaurant_id = r.restaurant_id
        -- Find restaurants opened on Monday at 3:00 am
        AND ADDTIME(ADDDATE('2021-12-01 00:00', MOD((7 + ${day_of_week} - DAYOFWEEK('2021-12-01')), 7)), '${open_at}') >= tmp.opening_date 
        -- I want to exclude the results that match the closing time as they are probably not relevant
        AND ADDTIME(ADDDATE('2021-12-01 00:00', MOD((7 + ${day_of_week} - DAYOFWEEK('2021-12-01')), 7)), '${open_at}') < tmp.closing_date
        ORDER BY r.restaurant_name;
        `;
        this.connection.query(sqlSearch, function (err, result) {
            (err) ? callback(err, null) : callback(null, result);
        });
    }
    

    closeConnection = () =>{
        this.connection.end();
    }

}
