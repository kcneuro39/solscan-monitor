const puppeteer = require('puppeteer');
const nodemailer = require('nodemailer');
const cron = require('node-cron');

// Function to check transactions on Solscan
async function checkTransactions() {
  console.log('Checking transactions...');
  try {
    // Launch Puppeteer with --no-sandbox for container compatibility
    console.log('Launching browser...');
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    console.log('Browser launched successfully');

    // Create a new page
    console.log('Creating new page...');
    const page = await browser.newPage();
    console.log('New page created');

    // Navigate to the Solscan URL
    const url = 'https://solscan.io/account/LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo?instruction=initializePositionByOperator';
    console.log('Navigating to Solscan page...');
    await page.goto(url, { waitUntil: 'networkidle2' });
    console.log('Navigated to Solscan page');

    // Extract transaction links
    console.log('Extracting transaction links...');
    const transactionLinks = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href^="/tx/"]'));
      return links.map(link => `https://solscan.io${link.getAttribute('href')}`);
    });
    console.log('Transaction links extracted:', transactionLinks);

    // Close the browser
    console.log('Closing browser...');
    await browser.close();
    console.log('Browser closed');

    // Send email if transactions are found
    if (transactionLinks.length > 0) {
      console.log('Sending email with transaction links...');
      sendEmail(transactionLinks);
    } else {
      console.log('No new transactions found.');
    }
  } catch (error) {
    console.error('Error in checkTransactions:', error);
  }
}

// Function to send email notifications
function sendEmail(links) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: 'kyle.txma@gmail.com',  // Your email
      pass: 'kbum xukh rxlh zoqp'   // Your app-specific password
    }
  });

  const mailOptions = {
    from: 'kyle.txma@gmail.com',
    to: 'kyle.txma@gmail.com',
    subject: 'New Transactions on Solscan',
    text: `Found new transactions:\n\n${links.join('\n')}`
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error('Email error:', error);
    } else {
      console.log('Email sent:', info.response);
    }
  });
}

// Schedule the task to run every hour
cron.schedule('0 * * * *', () => {
  console.log('Scheduled check initiated.');
  checkTransactions();
});

// Start the monitor
console.log('Transaction monitor started.');