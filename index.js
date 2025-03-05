const puppeteer = require('puppeteer');
const nodemailer = require('nodemailer');
const cron = require('node-cron');

// Set up process event listeners to catch unexpected errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1); // Exit with failure code to signal a crash
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1); // Exit with failure code
});

// Function to check transactions on Solscan
async function checkTransactions() {
  console.log('Checking transactions...');
  try {
    console.log('Launching browser...');
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    console.log('Browser launched successfully');

    console.log('Creating new page...');
    const page = await browser.newPage();
    console.log('New page created');

    const url = 'https://solscan.io/account/LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo?instruction=initializePositionByOperator';
    console.log('Navigating to Solscan page...');
    await page.goto(url, { waitUntil: 'networkidle2' });
    console.log('Navigated to Solscan page');

    console.log('Extracting transaction links...');
    const transactionLinks = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href^="/tx/"]'));
      return links.map(link => `https://solscan.io${link.getAttribute('href')}`);
    });
    console.log('Transaction links extracted:', transactionLinks);

    console.log('Closing browser...');
    await browser.close();
    console.log('Browser closed');

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
      user: 'kyle.txma@gmail.com',  // Replace with your email
      pass: 'kbum xukh rxlh zoqp'   // Replace with your app-specific password
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

// Application startup
console.log('Transaction monitor starting...');

try {
  console.log('Setting up cron job...');
  cron.schedule('0 * * * *', async () => {
    try {
      console.log('Scheduled check starting...');
      await checkTransactions();
    } catch (error) {
      console.error('Error in scheduled check:', error);
    }
  });
  console.log('Cron job scheduled successfully');
} catch (error) {
  console.error('Error scheduling cron job:', error);
}

console.log('Transaction monitor started.');