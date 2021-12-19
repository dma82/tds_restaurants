'use strict';

let _ = require('lodash'),
    csv = require('csvtojson'),      
    debug = require('debug')('TDS'),
    moment = require('moment'),
    path = require("path"),
    Database = require('../utils/database.js');

/* 
    This is a utility class that reads the CSV file, manipulate each record,
    and insert the object into MYSQL DB. The structure of the object that is created here is as follow:

    {
        restaurants: [ <ARRAY>
            {
                restaurant_name: <STRING>,
                openingDays: [ <ARRAY>
                    { 
                        dayOfTheWeek: <NUMBER 1-7>,
                        openingTime: 'STRING e.g. "11:00"'
                        closingTime: 'STRING e.g. "02:30"'
                    }
                ]
            }
        ]
    }
*/

const database = new Database();

module.exports = class Utility {

    async load()  {
        let days_of_week = { 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6, 'Sun': 7 };
        
        // Define a RegExp to extract the time range
        const regex_time = /([01][0-2]|(?<!1)[0-9])(:([0-5][0-9]))? ?((a|p)m|(A|P)M)/gm;
        

        await csv({
            noheader: true,
            // original source has no header row, so use 'name' and 'schedule' as its header row
            headers: ['name','schedule'],
            trim: true,
        })
        .fromFile(path.join(__dirname, '../data/rest_open_hours.csv')) // Load the CSV file
        .then((jsonObject) =>{
            let restaurants = [];
            _.each(jsonObject, _restaurant => {
                let restaurant = { name: _restaurant.name, openingDays: [] };
                // Split the timetable by "/" and remove any leading or trailing space
                let schedules = _restaurant.schedule.split('/').map(item=>item.trim());
                for(let i = 0; i < schedules.length; i++){
                    // Use a RegEx to get the time range, i.e. "11:30 am - 10 pm"
                    let scheduled_time = schedules[i].match(regex_time);
                    // Get the days from the string subtracting the time range, split by "," and remove any leading or trailing space
                    let scheduled_days = schedules[i].substring(0, schedules[i].indexOf(scheduled_time[0])).split(',').map(item=>item.trim());
        
                    let days = [];
                    for(let k = 0; k < scheduled_days.length; k++){
                        // If the current element is a range, i.e. Mon-Thu then split by "-"
                        if (scheduled_days[k].indexOf('-') >= 0) {
                            let arr_days = scheduled_days[k].split('-');
                            // Get the numeric value associated to the start date of the range
                            let start_day = days_of_week[arr_days[0]];
                            // Get the numeric value associated to the end date of the range
                            let end_day = days_of_week[arr_days[1]];
                            for(let j = start_day; j <= end_day; j++){
                                days.push({ 
                                    dayOfTheWeek: j, // Numeric value associated to the day
                                    //Convert a string e.g. '10:30 am' into time H24 time
                                    openingTime: moment(scheduled_time[0], ["h:mm A"]).format("HH:mm"), // The first element is the opening time
                                    closingTime: moment(scheduled_time[1], ["h:mm A"]).format("HH:mm")  // The second element is the closing time
                                });
                            }
                        }
                        // If the current element is a single day, then add it to the array of days
                        else {
                            days.push({ 
                                dayOfTheWeek: days_of_week[scheduled_days[k]],
                                openingTime: moment(scheduled_time[0], ["h:mm A"]).format("HH:mm"),
                                closingTime: moment(scheduled_time[1], ["h:mm A"]).format("HH:mm")
                            });
                        }
                    }
                    // Merge the current array of the days to the existing one in "restaurant" object
                    Array.prototype.push.apply(restaurant.openingDays, days);
                }
        
                // Add the restaurant object to the list of restaurants
                restaurants.push(restaurant);
            })
            debug(_.find(restaurants, (r) => { return r.name === 'Marrakech Moroccan Restaurant'}));
            database.checkTables(function(err, data){
                if (err) {
                    debug("Error:", err);            
                } else {            
                    if (data === 0) {
                        _.each(restaurants, restaurant => {
                            // This is to handle multiple async transactions 
                            database.getConnection().beginTransaction(function (err) {
                                if (err) {
                                    throw err;
                                }
                                // Insert a new restaurant
                                database.inserRestaurant(restaurant, function (err, result) {
                                    if (err) {
                                        debug('Error', err)
                                        database.rollback(database.getConnection(), err);
                                    }
                                    
                                    if(result){
                                        // Insert the opening time of the restaurand
                                        database.insertSchedule(restaurant.openingDays, result.insertId, function (error, data) {
                                            if (error) {
                                                debug('Error', error)
                                                database.rollback(database.getConnection(), error);
                                            } else {
                                                database.commit(database.getConnection());
                                            }
                                        });
                                    }
                                    database.commit(database.getConnection());
                                });
                                
                            });
                        });
                    }
                } 
            });
        });
    }


    initalize() {
        database.initialiseDB();
        database.initialiseTables();
    }

    start = async () =>{
        await this.load();
    }


    getOpenRestaurants (day_of_week, open_at){
        database.getOpenRestaurants(day_of_week, open_at, function(err, data){
            if (err) {
                debug("Error:", err); 
                database.getConnection().end();           
            } else {            
                debug(data);
            }
        })
    }

}