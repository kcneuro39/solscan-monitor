// Solscan Transaction Monitor using Node.js with Puppeteer
// This script can be run on a free service like Render.com or Railway.app

const puppeteer = require('puppeteer');
const nodemailer = require('nodemailer');
const fs = require('fs/promises');
const path = require('path');

// Configuration - Update these values
const CONFIG = {
  email: {
    to: "kyle.txma@gmail.com",
    from: "kyle.txma@gmail.com", // Gmail or other SMTP provider
    smtpConfig: {
      service: 'gmail',
      auth: {
        user: 'kyle.txma@gmail.com',
        pass: 'ajpq delv czvz noti' // You'll need to create an app password in your Google account
      }
    }
  },
  solana: {
    programAddress: "LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo",
    instructionsToMonitor: ["initializePositionByOperator"]
  },
  storage: {
    filePath: path.join(__dirname, 'lastSeenTxs.json')
  },
  schedule: {
    intervalMinutes: 60
  }
};

// Main function
async function monitorTransactions() {
  console.log(`Starting transaction monitoring at ${new Date().toISOString()}`);
  
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    // Load previously seen transactions
    const lastSeenTxs = await loadLastSeenTransactions();
    
    for (const instruction of CONFIG.solana.instructionsToMonitor) {
      console.log(`Checking for transactions with instruction: ${instruction}`);
      
      const page = await browser.newPage();
      
      // Navigate to Solscan page with the specific instruction filter
      const url = `https://solscan.io/account/${CONFIG.solana.programAddress}?instruction=${instruction}`;
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
      
      // Wait for the transaction table to load
      await page.waitForSelector('table tbody tr', { timeout: 60000 });
      
      // Extract transaction data
      const transactions = await page.evaluate(() => {
        const result = [];
        const rows = document.querySelectorAll('table tbody tr');
        
        rows.forEach(row => {
          // Extract transaction ID from the row
          const txIdElement = row.querySelector('a[href^="/tx/"]');
          if (!txIdElement) return;
          
          const txUrl = txIdElement.getAttribute('href');
          const txId = txUrl.replace('/tx/', '');
          
          // Extract timestamp (this selector might need adjustment)
          const timestampElement = row.querySelector('td:nth-child(2)');
          const timestamp = timestampElement ? timestampElement.textContent.trim() : 'Unknown';
          
          result.push({
            id: txId,
            timestamp: timestamp,
            url: `https://solscan.io/tx/${txId}`
          });
        });
        
        return result;
      });
      
      console.log(`Found ${transactions.length} transactions for instruction ${instruction}`);
      
      // Close the page
      await page.close();
      
      if (transactions.length > 0) {
        // Get last seen transaction IDs for this instruction
        const lastSeenForInstruction = lastSeenTxs[instruction] || [];
        
        // Filter only new transactions
        const newTransactions = transactions.filter(tx => !lastSeenForInstruction.includes(tx.id));
        
        if (newTransactions.length > 0) {
          console.log(`Found ${newTransactions.length} new transactions for instruction ${instruction}`);
          
          // Update last seen transactions
          lastSeenTxs[instruction] = [
            ...transactions.map(tx => tx.id),
            ...lastSeenForInstruction
          ].slice(0, 50); // Keep the 50 most recent transactions
          
          // Send email notification
          await sendNotificationEmail(instruction, newTransactions);
        } else {
          console.log(`No new transactions found for instruction ${instruction}`);
        }
      }
    }
    
    // Save updated last seen transactions
    await saveLastSeenTransactions(lastSeenTxs);
    
  } catch (error) {
    console.error('Error during monitoring:', error);
  } finally {
    await browser.close();
    console.log(`Completed monitoring at ${new Date().toISOString()}`);
  }
}

// Load previously seen transaction IDs
async function loadLastSeenTransactions() {
  try {
    const data = await fs.readFile(CONFIG.storage.filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.log('No previous transaction data found or error reading file. Starting fresh.');
    return {};
  }
}

// Save seen transaction IDs
async function saveLastSeenTransactions(data) {
  try {
    await fs.writeFile(CONFIG.storage.filePath, JSON.stringify(data, null, 2), 'utf8');
    console.log('Transaction data saved successfully');
  } catch (error) {
    console.error('Error saving transaction data:', error);
  }
}

// Send email notification
async function sendNotificationEmail(instruction, transactions) {
  // Create transporter
  const transporter = nodemailer.createTransport(CONFIG.email.smtpConfig);
  
  // Build email content
  const subject = `New Solana Transactions: ${instruction}`;
  
  let htmlBody = `<h2>New Solana Transactions Detected</h2>
                  <p>The following new transactions with instruction <strong>${instruction}</strong> were detected:</p>
                  <ul>`;
  
  for (const tx of transactions) {
    htmlBody += `
      <li>
        <strong>Transaction:</strong> ${tx.id}<br>
        <strong>Timestamp:</strong> ${tx.timestamp}<br>
        <strong>Link:</strong> <a href="${tx.url}">${tx.url}</a>
      </li>`;
  }
  
  htmlBody += `</ul>
               <p><a href="https://solscan.io/account/${CONFIG.solana.programAddress}?instruction=${instruction}">
                  View all transactions
               </a></p>`;
  
  // Send the email
  try {
    await transporter.sendMail({
      from: CONFIG.email.from,
      to: CONFIG.email.to,
      subject: subject,
      html: htmlBody
    });
    
    console.log(`Notification email sent for ${transactions.length} new transactions`);
  } catch (error) {
    console.error('Error sending email:', error);
  }
}

// Run the monitoring function initially
monitorTransactions();

// Then schedule it to run at the specified interval
setInterval(monitorTransactions, CONFIG.schedule.intervalMinutes * 60 * 1000);

// Handle process termination gracefully
process.on('SIGINT', () => {
  console.log('Monitoring stopped');
  process.exit(0);
});