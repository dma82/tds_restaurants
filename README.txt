===== PRE - REQUIREMENTS

This application relies on MySQL

    1) Download MySQL at https://dev.mysql.com/downloads/installer/

    2) Install MySQL and leave everything to the default options

    3) Create root user

    4) Create a second user, e.g.
            user:       tdsuser
            password:   tdspassword

    5) If you don't want to use the suggested user as per step 4, remember to replace these credentials in `settings.json` file

    6) Open a terminal in the current folder

        6.1) Install all dependencies by running `npm install` if you are running the solution for the first time

    7) Test the connectivity to the DB by running `npde app.js`

        7.1) If you get `Error: ER_NOT_SUPPORTED_AUTH_MODE: Client does not support authentication protocol requested by server; consider upgrading MySQL client`, 
             try to run the following statements from a MySQL shell:

             ALTER USER 'tdsuser' IDENTIFIED WITH mysql_native_password BY 'tdspassword';
             FLUSH PRIVILEGES;

    8) Once the connectivity with the DB has been checked, run `Ctrl + C` to stop the server


===== START THE APPLICATION

    1) Open a terminal in the current folder

        1.1) Install all dependencies by running `npm install` if you are running the solution for the first time

    2) Run `gulp` to start the application; the server will be started and the main page will be loaded

    3) `Ctrl + C` to stop the server




===== TEST THE APPLICATION

    1) Open a terminal in the current folder

        1.1) Install all dependencies by running `npm install` if you are running the solution for the first time

    2) Run `npm test`