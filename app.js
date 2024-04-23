// Import required modules
const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql2');
const jwt = require('jsonwebtoken');
const path = require('path');
const { ejs } = require('ejs');
const winston =  require('winston');
const cookieParser = require( 'cookie-parser' );

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    transports: [
        new winston.transports.File( { filename: 'error.log', level: 'error' } ),
        new winston.transports.File( {  filename: 'combined.log' } ),
    ],
});

// Add console log for development
if(process.env.NODE_ENV !== "test")
{
    logger.add(new winston.transports.Console({
        format: winston.format.simple(),
    }));
}

// Create an Express app instance
const app = express();
const PORT = 3000;

// Secret key for JWT
const JWT_SECRET = 'secret_key';

// Database connection setup
const connection = mysql.createConnection({
    host: "localhost",
    user: "root",
    password:  "hellorajat",
    database: "your_mysql_database" // Changed to match MySQL database
});

// Connect to the database
connection.connect((err) => {
   if (err) 
   {
    console.error('Error connecting to Db' + err.stack);
    return;
   }
   console.log('Connected to the MySQL! ');
});

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));


// Middleware setup
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json()); 
app.use(cookieParser());


// Route to render login form
app.get('/user_login', (req, res) =>{
    res.sendFile(path.join(__dirname, 'public', 'user_login.html'));
});

// Route to render registration form
app.get('/user_registration', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'user_registration.html'));
});

// Endpoint to handle user registration
app.post('/user_registration', async (req, res, next) => {
    try 
    {
        // Extract user registration data from request body
        const { fullName, dateOfBirth, username, phoneNumber, emailAddress, password, confirmPassword } = req.body;
        
        // Check if passwords match
        if (password !== confirmPassword) 
        {
            return res.status(400).json({ message: 'Passwords do not match.' });
        }

        // SQL query to insert user data into the database
        const sql = 'INSERT INTO usermaster (fullName, dateOfBirth, username, phoneNumber, emailAddress, password) VALUES (?, ?, ?, ?, ?, ?)';
        
        // Execute the SQL query with user data
        connection.query(sql, [ fullName, dateOfBirth, username, phoneNumber, emailAddress, password ], (err, result) => {
            if (err) 
            {
                console.error('Error in Inserting User:' + err.stack);
                return res.status(500).json({ message: "Internal Server Error! Error while inserting user." }); 
            }
            console.log('User Inserted:', result);
            console.log('===============================');
            res.redirect("/user_data");
        });
    } 
    catch (error)
    {
        console.log("/user_registration: Caught an error:" + error );
        return next(error);
    }
});

// // Endpoint to retrieve user data and render the view
app.get( '/user_data', (req, res) => {
    const sql = "SELECT id, fullName, username, phoneNumber, emailAddress, DATE_FORMAT(dateOfBirth, '%d-%m-%Y') AS dateOfBirth FROM usermaster";
    connection.query(sql, (err, rows) => {
        if (err) 
        {
            console.error('Error retrieving user:', err.stack);
            return res.status(500).json({ message: 'Internal server error' });
        }
        console.log('Users retrieved successfully!');
        console.log('Retrieved Users.');
        res.render('user_data', { data: rows });
        console.log('===============================');
    });
});

// Endpoint to handle user login
app.post('/user_login', async (req, res, next) => {
    try 
    {
        // Check the token availablity
        const chk_token = req.cookies.token;
        if(chk_token)
        {
            res.status(403).json({ message: 'You are already logged in!' });
            return next(new Error('Already logged in'));
        }

        // Extract username and password from request body
        const { username, password } = req.body;

        // SQL query to retrieve user data based on username and password
        const sql = 'SELECT * FROM usermaster WHERE username = ? AND password = ?';
        
        // Execute the SQL query with username and password
        connection.query(sql, [username, password], (err, result) => {
            console.log('Login Attempt: ', result); 
            if (err || result.length === 0) 
            {
                return res.status(401).json({ message: 'Invalid Credentials, Username or Password' });
            }

            // Generate JWT token
            const token = jwt.sign({ username: username }, JWT_SECRET );
            console.log('Token:', token);
            res.cookie('token', token, { maxAge: 20000, httpOnly: true });

            res.status(200).json({ message: "User Logged In Successfully" });
            console.log('Login successful!');
            console.log('===============================');

        });
    } 
    catch (error) 
    {
        console.log('/user_login error :');
        console.error(error);
        return next(error);
    }
});

// Endpoint to search for a user based on username and date of birth comparison
// New search
var obj = {};
app.post('/user_search', async (req, res, next) => {
    try 
    {
        console.log('How It should be: %j',req.body);
        console.log('------');
        console.log('How it is :', req.body);

        // Initialize an empty array to hold conditions for the SQL query
        let conditions = [];
        let queryParams = [];

        // Extract search parameters from req.body
        const { username, fullName, emailAddress, dateOfBirth, toDate, dobComparison } = req.body;

        console.log(username, fullName, emailAddress, dateOfBirth, toDate, dobComparison);

        // Add conditions for each search parameter
        if (username) 
        {
            conditions.push("username LIKE '%"  + username + "%'");
            queryParams.push(username);
        }
        if (fullName) 
        {
            conditions.push("fullName  LIKE '%"  + fullName + "%'");
            queryParams.push(fullName);
        }
        if (emailAddress) 
        {
            conditions.push("emailAddress  LIKE '%"  + emailAddress + "%'");
            queryParams.push(emailAddress);
        }
        if (dateOfBirth && dobComparison === 'Equal') 
        {
            conditions.push("dateOfBirth = ?");
            queryParams.push(dateOfBirth);
        } 
        else if (dateOfBirth && dobComparison === 'Greater') 
        {
            conditions.push("dateOfBirth > ?");
            queryParams.push(dateOfBirth);
        } 
        else if (dateOfBirth && dobComparison === 'Less')
        {
            conditions.push("dateOfBirth < ?");
            queryParams.push(dateOfBirth);
        } 
        else if (dateOfBirth && toDate && dobComparison === 'Range') 
        {
            conditions.push("dateOfBirth BETWEEN ? AND ?");
            queryParams.push(dateOfBirth, toDate);
        }

        // Construct the SQL query
        let sql = `SELECT id, fullName, username, phoneNumber, emailAddress, DATE_FORMAT(dateOfBirth, "%d-%m-%Y") AS dateOfBirth FROM usermaster`;

        if (conditions.length > 0) 
        {
            sql += " WHERE " + conditions.join(" AND ");
        }

        console.log('SQL Query:', sql);
        console.log('Query Parameters:', queryParams);

        // Execute the SQL query with the provided parameters
        connection.query(sql, queryParams, (err, results) => {
            console.log('HI-jack: ', results);
            if (err || results.length === 0) 
            {
                console.log('No user found.');
                res.render('no_user_found'); // Render the view for no user found
            } 
            else 
            {
                console.log('User search successful!');
                res.render('user_data', { data: results }); // Render the view with the found users
                console.log('===========================');
            }
        });
    } 
    catch (error) 
    {
        console.log('/user_search: ');
        console.error(error);
        return next(error);
    }
});

async function fetchData() 
{
    return new Promise((resolve, reject) => {
        // Simulate an error
        connection.connect(function (err) 
        {
            if (err) throw err;

            console.log("Connected");
            var sql = "SELECT id, fullName, username, phoneNumber, emailAddress, dateOfBirth FROM usermaster";
            connection.query(sql, function (err, result) 
            {
                if (err) 
                {
                    reject(err);
                } 
                else 
                {
                    obj = { print: result };
                    console.log(obj);
                    resolve(obj);
                }
            });
        });
        setTimeout(() => {
            reject(new Error('Failed to fetch data'));
        }, 10000);
    });
}

// Call fetchData function on user_search route
app.post('/user_search', async (req, res) => {
    try 
    {
        const chk = await fetchData();
        res.render('user_data', { data: obj });
    } 
    catch (error) 
    {
        console.log('In other /user_search: ');
        console.log(error);
    }
});

// Route to render delete and update user forms
app.get('/delete-fields', (req, res) => {
    res.render('delete-fields');
});

app.get('/user/:userId/edit', (req, res) => {
    res.render('user-edit');
});

// Endpoint to delete a user based on username
app.post('/user/:username/delete', async (req, res, next) => {
    try 
    {
        // Extract username from request parameters
        const paramUName = req.params.username;
        console.log('Delete request received for:', paramUName);

        // SQL query to delete a user based on username
        const sql = 'DELETE FROM usermaster WHERE username = ?';

        // Execute the SQL query with the provided username
        connection.query(sql, [paramUName], (err, result) => {
            if (err) 
            {
                console.error(err);
                return res.status(500).send('Internal Server Error');
            }

            console.log('User deleted successfully!');
            // Redirect to the user data page after deleting the user
            res.redirect('/user_data');
        });
    } 
    catch (error) 
    {
        console.log('/user-delete block: ')
        console.error(error);
        return next(error);
    }
});

app.get('/no_user_found', (req, res) => {
    console.log('IN no_user_found, page');
    res.render('no_user_found');
});

// Route to fetch user data for editing
app.get('/senduser/:userId', (req, res, next) => {
    try
    {
        const data = req.params.userId;
        console.log('Serching User for updating.');
        console.log(data);
        const sql = "SELECT id, fullName, username, phoneNumber, emailAddress, DATE_FORMAT(dateOfBirth, '%Y-%m-%d') AS dateOfBirth FROM usermaster WHERE id = ?";
        
        // Execute the SQL query to fetch user data for the specified userId
        connection.query(sql, [data], (err, rows) => {
            if (err) 
            {
                console.error('Error retrieving user:', err.stack);
                return res.status(500).send('Internal Server Error'); // Handle database error
            }

            if (rows.length === 0) 
            {
                return res.status(404).json({ message: 'User not found' }); // Return 404 if user not found
            }
            console.log('User Found...');
            console.log('HI-jack :', rows);
            res.render('senduseredit', { userData: rows[0] });
            console.log('===============================');
        });
    }
    catch (error)
    {
        console.log("/senduser ERROR: ", error);
        return next(error);
    }
});

// Route to handle user edit form submission
app.post('/user/:userId', async (req, res, next) => {
    try 
    {
        console.log('User edited the details.');
        console.log('Data send from Front-End: ',req.body);
        const userId = req.params.userId;
        console.log('User-Id: ',userId);
        const { fullName, username, emailAddress, phoneNumber, dateOfBirth } = req.body;

        console.log('Values :', fullName,'|', username,'|', emailAddress,'|', phoneNumber,'|', dateOfBirth);

        // Update user data in the database
        await new Promise((resolve, reject) => {
            const sql = 'UPDATE usermaster SET fullName = ?, username = ?, emailAddress = ?, phoneNumber = ?, dateOfBirth = ? WHERE id = ?';
            connection.query(sql, [fullName, username, emailAddress, phoneNumber, dateOfBirth, userId], (err, results) => {
                console.log('Query :', sql);
                console.log('HI-jack :', results);       
                if (err) 
                {
                    console.error('Error updating user data:', err);
                    reject(err); // Reject the Promise if there's an error
                } 
                else 
                {
                    resolve(); // Resolve the Promise if the update is successful
                }
            });
        });
        console.log('===============================');
        // Redirect to user_data page after successful update
        res.redirect('/user_data');
    } 
    catch (error) 
    {
        console.error('/user form submittion Error updating user data:', error);
        return next(error);
    }
});

// Error handeling
app.use((error, req, res, next) => {
    logger.error(`${error}`);       //Error log
    // Handle different error
    if(error instanceof SyntaxError && error.status === 400 && 'body' in error)
    {
        res.status(400).send("Invalid request body format / Syntax error");
    }
    else        
    {
        // Handle other error
        res.status(500).send("Internal Server Error");
    }
});

// Middleware to verify JWT token
const verifyJWT = (req, res, next) => {
    const token = req.cookies.token; // Corrected from req.cookie.token
    if (!token) 
    {
        console.log('Token Not Provided either exist..!');
        return res.status(401).send('Access Denied! No Token Provided'); // Change status to 401 for unauthorized access
    }
    jwt.verify(token, JWT_SECRET, (error, decoded) => {
        if (error) 
        {
            if (error.name === 'TokenExpiredError') 
            {
                // Handle expired token
                res.clearCookie('token');
                console.log('Token Expired!');
                return res.status(401).send('Token Expired! Please log in again.');
            } 
            else if (error.name === 'JsonWebTokenError') 
            {
                // Handle invalid token
                res.clearCookie('token');
                console.log('Invalid Token!');
                return res.status(401).send('Invalid Token! Please log in again.');
            } 
            else 
            {
                // Handle other errors
                console.error('Error verifying JWT token:', error);
                return res.status(500).send('Internal Server Error');
            }
        }
        else 
        {
            req.User = decoded;
            next();
        }
    });
};

// Protected route
app.get('/protected', verifyJWT, (req, res) => {
    console.log('The route is protected.');
    res.json({ message: 'Accessing it in protected route', user: req.user });
});

// 404 Handler
app.use(( req, res ) => {
    res.status(404).send('404 Not Found');
});

// Start server
app.listen(PORT, () => {
    console.log(`App is Listed on http:localhost:${PORT}`);
});