// app.js
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const fetch = require('node-fetch');
const xlsx = require('xlsx');

const app = express();
const port = 3000;


// Set up SQLite database
const db = new sqlite3.Database(':memory:');

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      name TEXT,
      email TEXT,
      phone TEXT,
      website TEXT,
      city TEXT,
      company TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS posts (
      userId INTEGER,
      title TEXT,
      body TEXT,
      company TEXT
    )
  `);
});
app.use(express.static('public'));

// Home Page
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

// Post Page
app.get('/user/:userId', (req, res) => {
  const userId = parseInt(req.params.userId);

  // Fetch user details
  db.get('SELECT * FROM users WHERE id = ?', userId, (err, user) => {
    if (err || !user) {
      return res.status(404).send('User not found');
    }

    // Fetch posts for the specific userId
    fetch(`https://jsonplaceholder.typicode.com/posts?userId=${userId}`)
      .then(response => response.json())
      .then(posts => {
        res.send({user,posts});
      })
      .catch(error => {
        console.error('Error fetching posts:', error);
        res.status(500).send('Internal Server Error');
      });
  });
});

// API to add a post to the database
app.post('/api/addPost/:userId', (req, res) => {
  const userId = parseInt(req.params.userId);
  console.log(req.query.company);

  // Check if posts already exist for the specific userId
  db.get('SELECT * FROM posts WHERE userId = ?', userId, (err, row) => {
    if (err) {
      console.error('Database error:', err);
      res.status(500).json({ error: 'Internal Server Error' });
    } else if (row) {
      // Posts already in the database
      res.json({ exists: true });
    } else {
 
    fetch(`https://jsonplaceholder.typicode.com/posts?userId=${userId}`)
    .then(response => response.json())
    .then(posts => {
      // Insert all posts into the database
      const stmt = db.prepare('INSERT INTO posts (userId, title, body,company) VALUES (?, ?, ?, ?)');
      posts.forEach(post => stmt.run(userId, post.title, post.body, req.query.company));
      stmt.finalize();

      res.json({ exists: false });
    })
    }
  });
});

// API to download posts in Excel format
app.get('/api/downloadExcel/:userId', (req, res) => {
  const userId = parseInt(req.params.userId);

  // Fetch posts for the specific userId
  db.all('SELECT * FROM posts WHERE userId = ?', userId, (err, posts) => {
    if (err) {
      console.error('Database error:', err);
      res.status(500).send('Internal Server Error');
    } else {
      const workbook = xlsx.utils.book_new();
      const worksheet = xlsx.utils.json_to_sheet(posts);
      xlsx.utils.book_append_sheet(workbook, worksheet, 'Posts');
      const excelBuffer = xlsx.write(workbook, { bookType: 'xlsx', type: 'buffer' });

      res.setHeader('Content-Disposition', `attachment; filename=posts_${userId}.xlsx`);
      res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.send(excelBuffer);
    }
  });
});
app.get('/api/users', async (req, res) => {
    try {
      const response = await fetch('https://jsonplaceholder.typicode.com/users');
      const users = await response.json();
      res.json(users);
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });
  app.post('/api/addUser/:id', (req, res) => {
    const userId = req.params.id;
  
    db.get('SELECT * FROM users WHERE id = ?', userId, (err, row) => {
      if (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
      } else if (row) {
        // User already in the database
        res.json({ exists: true });
      } else {
        // User not in the database, fetch from API and add to the database
        fetch(`https://jsonplaceholder.typicode.com/users/${userId}`)
          .then(response => response.json())
          .then(user => {
            db.run(
              'INSERT INTO users (id, name, email, phone, website, city, company) VALUES (?, ?, ?, ?, ?, ?, ?)',
              [user.id, user.name, user.email, user.phone, user.website, user.address.city, user.company.name],
              err => {
                if (err) {
                  console.error('Database error:', err);
                  res.status(500).json({ error: 'Internal Server Error' });
                } else {
                  res.json({ exists: false });
                }
              }
            );
          })
          .catch(error => {
            console.error('Error fetching user from API:', error);
            res.status(500).json({ error: 'Internal Server Error' });
          });
      }
    });
  });


// Start the server
app.listen(port, () => {
  console.log(`Server is running at https://cointab-post.onrender.com:${port}`);
});
