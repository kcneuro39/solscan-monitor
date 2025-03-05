const puppeteer = require('puppeteer');
const nodemailer = require('nodemailer');
const cron = require('node-cron');

// Set up process event listeners to catch unexpected errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception - CRASH:', {
    message: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString(),
    pid: process.pid
  });
  process.exit(1); // Exit with failure code
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection - CRASH:', {
    reason: reason.message || reason,
    promise: promise,
    timestamp: new Date().toISOString(),
    pid: process.pid
  });
  process.exit(1); // Exit with failure code
});

// Function to check transactions on Solscan
async function checkTransactions() {
  console.log('Checking transactions - START:', new Date().toISOString(), 'PID:', process.pid);
  let transactionLinks = []; // Define transactionLinks outside the loop
  try {
    console.log('Waiting 10 seconds before launching browser to avoid resource spike...');
    await new Promise(resolve => setTimeout(resolve, 10000)); // Delay to prevent immediate resource use

    console.log('Launching browser...');
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      timeout: 30000 // 30-second timeout for browser launch
    });
    console.log('Browser launched successfully');

    console.log('Creating new page...');
    const page = await browser.newPage();
    console.log('New page created');

    const baseUrl = 'https://solscan.io/account/LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo?instruction=initializePositionByOperator';
    let currentPage = 1;
    let hasNextPage = true;

    while (hasNextPage && currentPage <= 5) { // Limit to first 5 pages
      console.log(`Navigating to page ${currentPage}...`);
      await page.goto(`${baseUrl}&page=${currentPage}`, { waitUntil: 'networkidle2', timeout: 30000 });
      console.log(`Navigated to page ${currentPage}`);

      console.log('Extracting transaction links from page...');
      const pageLinks = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a[href^="/tx/"]'));
        return links.map(link => `https://solscan.io${link.getAttribute('href')}`);
      });
      console.log(`Transaction links extracted for page ${currentPage}:`, pageLinks.length, 'links:', pageLinks);

      transactionLinks = [...new Set([...transactionLinks, ...pageLinks])]; // Use Set to avoid duplicates within pages

      // Check for next page (adjust selector based on Solscan’s HTML)
      hasNextPage = await page.evaluate(() => {
        const nextButton = document.querySelector('a.pagination-next'); // Example selector—update if needed
        return nextButton && !nextButton.classList.contains('disabled');
      });
      console.log(`Next page available: ${hasNextPage}`);
      currentPage++;
    }

    console.log('Total transaction links accumulated:', transactionLinks.length, 'links:', transactionLinks);
    console.log('Closing browser...');
    await browser.close();
    console.log('Browser closed');

    if (transactionLinks.length > 0) {
      console.log('Sending email with transaction links...');
      sendEmail(transactionLinks);
    } else {
      console.log('No transactions found.');
    }
  } catch (error) {
    console.error('Error in checkTransactions - CRASH:', {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      pid: process.pid
    });
  }
  console.log('Checking transactions - END:', new Date().toISOString(), 'PID:', process.pid);
}

// Function to send email notifications
function sendEmail(links) {
  console.log('Preparing to send email...', new Date().toISOString());
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
    text: `Found transactions:\n\n${links.join('\n')}`
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error('Email error - CRASH:', {
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString(),
        pid: process.pid
      });
    } else {
      console.log('Email sent:', info.response);
    }
  });
}

// Wrap the startup code in an async IIFE to handle await correctly
(async () => {
  console.log('Transaction monitor starting - START:', new Date().toISOString(), 'PID:', process.pid);

  try {
    console.log('Running initial transaction check...');
    await checkTransactions(); // Run immediately on startup

    console.log('Setting up cron job...');
    cron.schedule('0 * * * *', async () => {
      try {
        console.log('Scheduled check starting - START:', new Date().toISOString(), 'PID:', process.pid);
        await checkTransactions();
        console.log('Scheduled check complete - END:', new Date().toISOString(), 'PID:', process.pid);
      } catch (error) {
        console.error('Error in scheduled check - CRASH:', {
          message: error.message,
          stack: error.stack,
          timestamp: new Date().toISOString(),
          pid: process.pid
        });
      }
    });
    console.log('Cron job scheduled successfully');
  } catch (error) {
    console.error('Error scheduling cron job or initial check - CRASH:', {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      pid: process.pid
    });
  }

  console.log('Transaction monitor started - END:', new Date().toISOString(), 'PID:', process.pid);
})();

// Add a heartbeat to check if the process is still running
setInterval(() => {
  console.log('Heartbeat: Still running -', new Date().toISOString(), 'PID:', process.pid, 'Memory:', process.memoryUsage().rss / 1024 / 1024, 'MB');
}, 5000); // Log every 5 seconds

// Add a health check to ensure the process stays alive
setTimeout(() => {
  console.log('Health check: Process still alive after 30 seconds -', new Date().toISOString());
}, 30000); // Check after 30 seconds