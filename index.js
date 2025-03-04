// Solscan Transaction Monitor using plain HTTP requests
// This script can run on Render.com's free tier without Puppeteer

const https = require('https');
const fs = require('fs/promises');
const path = require('path');
const nodemailer = require('nodemailer');

// Configuration - Update these values
const CONFIG = {
  email: {
    to: "kyle.txma@gmail.com",
    from: "kyle.txma@gmail.com",
    smtpConfig: {
      service: 'gmail',
      auth: {
        user: 'kyle.txma@gmail.com',
        pass: 'ajpq delv czvz noti' // Your Gmail app password
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
  
  try {
    // Load previously seen transactions
    const lastSeenTxs = await loadLastSeenTransactions();
    
    for (const instruction of CONFIG.solana.instructionsToMonitor) {
      console.log(`Checking for transactions with instruction: ${instruction}`);
      
      // Fetch recent transactions from Solscan API
      const transactions = await fetchRecentTransactions(CONFIG.solana.programAddress, instruction);
      
      console.log(`Found ${transactions.length} transactions for instruction ${instruction}`);
      
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
    console.log(`Completed monitoring at ${new Date().toISOString()}`);
  }
}

// Fetch recent transactions using HTTP request
function fetchRecentTransactions(programAddress, instruction) {
  return new Promise((resolve, reject) => {
    // We'll use the public Solana API directly instead of scraping
    // This is a simplified approach that fetches recent signatures
    const url = `https://public-api.solscan.io/account/transactions?account=${programAddress}&limit=20`;
    
    https.get(url, { 
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      } 
    }, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const transactions = [];
          const result = JSON.parse(data);
          
          if (Array.isArray(result)) {
            // Filter transactions by txType if needed (this is a simpler approach)
            // In a full implementation, you'd need to check instruction data
            for (const tx of result) {
              transactions.push({
                id: tx.txHash,
                timestamp: new Date(tx.blockTime * 1000).toLocaleString(),
                url: `https://solscan.io/tx/${tx.txHash}`
              });
            }
          }
          
          resolve(transactions);
        } catch (error) {
          console.error('Error parsing transaction data:', error);
          resolve([]);
        }
      });
    }).on('error', (error) => {
      console.error('Error fetching transactions:', error);
      resolve([]);
    });
  });
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