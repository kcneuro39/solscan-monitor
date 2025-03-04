const puppeteer = require('puppeteer');
const nodemailer = require('nodemailer');
const cron = require('node-cron');

async function checkTransactions() {
  // Launch a headless browser
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  // Go to the Solscan page with your filter
  const url = 'https://solscan.io/account/LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo?instruction=initializePositionByOperator';
  await page.goto(url, { waitUntil: 'networkidle2' });

  // Extract transaction links (this selector might need tweaking)
  const transactionLinks = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a[href^="/tx/"]'));
    return links.map(link => `https://solscan.io${link.getAttribute('href')}`);
  });

  // Close the browser
  await browser.close();

  // If there are new transactions, send an email
  if (transactionLinks.length > 0) {
    sendEmail(transactionLinks);
  }
}

function sendEmail(links) {
  // Set up email service (using Gmail as an example)
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: 'kyle.txma@gmail.com', // Replace with your email
      pass: 'kbum xukh rxlh zoqp'   // Replace with your password or app password
    }
  });

  // Email details
  const mailOptions = {
    from: 'kyle.txma@gmail.com',
    to: 'kyle.txma@gmail.com',     // Replace with where you want notifications
    subject: 'New Transactions on Solscan',
    text: `Found new transactions:\n\n${links.join('\n')}`
  };

  // Send the email
  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.log('Email error:', error);
    } else {
      console.log('Email sent:', info.response);
    }
  });
}

// Run every hour (e.g., at the start of each hour)
cron.schedule('0 * * * *', () => {
  console.log('Checking transactions...');
  checkTransactions();
});

// Start the monitor
console.log('Transaction monitor started.');