const puppeteer = require('puppeteer');
const nodemailer = require('nodemailer');
const cron = require('node-cron');

// Function to check transactions on Solscan
async function checkTransactions() {
  console.log('Checking transactions...');
  try {
    // Launch Puppeteer browser with --no-sandbox flag for containerized environments
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    console.log('Browser launched successfully');

    // Create a new page
    const page = await browser.newPage();
    console.log('New page created');

    // Navigate to the Solscan account page with the specified filter
    const url = 'https://solscan.io/account/LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo?instruction=initializePositionByOperator';
    await page.goto(url, { waitUntil: 'networkidle2' });
    console.log('Navigated to Solscan page');

    // Extract transaction links from the page
    const transactionLinks = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href^="/tx/"]'));
      return links.map(link => `https://solscan.io${link.getAttribute('href')}`);
    });
    console.log('Transaction links extracted:', transactionLinks);

    // Close the browser
    await browser.close();
    console.log('Browser closed');

    // Send an email if there are new transactions
    if (transactionLinks.length > 0) {
      sendEmail(transactionLinks);
    }
  } catch (error) {
    console.error('Error in checkTransactions:', error);
  }
}

// Function to send email notifications
function sendEmail(links) {
  // Configure email transporter using Nodemailer
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: 'kyle.txma@gmail.com', // Replace with your email
      pass: 'kbum xukh rxlh zoqp'  // Replace with your app-specific password
    }
  });

  // Define email content
  const mailOptions = {
    from: 'kyle.txma@gmail.com',    // Sender email
    to: 'kyle.txma@gmail.com',      // Recipient email
    subject: 'New Transactions on Solscan',
    text: `Found new transactions:\n\n${links.join('\n')}`
  };

  // Send the email
  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error('Email error:', error);
    } else {
      console.log('Email sent:', info.response);
    }
  });
}

// Schedule the transaction check to run every hour
cron.schedule('0 * * * *', () => {
  checkTransactions();
});

// Log when the monitor starts
console.log('Transaction monitor started.');