// Solscan Transaction Monitor using Puppeteer
// This script will properly check instruction-specific transactions

const puppeteer = require('puppeteer');
const nodemailer = require('nodemailer');
const fs = require('fs/promises');
const path = require('path');

// Configuration - Update these values
const CONFIG = {
  email: {
    to: "kyle.txma@gmail.com",
    from: "kyle.txma@gmail.com",
    smtpConfig: {
      service: 'gmail',
      auth: {
        user: 'kyle.txma@gmail.com',
        pass: 'kbum xukh rxlh zoqp' // Your Gmail app password
      }
    }
  },
  solana: {
    programAddress: "LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo",
    instructionsToMonitor: [
      "initializePositionByOperator",
      "initializePermissionLbPair",
      "addLiquidity",
      "addLiquidityByStrategyOneSide",
      "addLiquidityOneSide",
      "initializePositionPda",
      "initializeCustomizablePermissionlessLbPair",
      "initializeBinArrayBitmapExtension",
      "updatePositionOperator",
      "swapExactOut",
      "swapWithPriceImpact",
      "withdrawProtocolFee",
      "initializeReward",
      "fundReward",
      "updateRewardFunder",
      "updateRewardDuration",
      "updateFeeParameters",
      "increaseOracleLength",
      "initializePresetParameter",
      "closePresetParameter",
      "togglePairStatus",
      "migratePosition",
      "migrateBinArray",
      "withdrawIneligibleReward",
      "setActivationPoint",
      "addLiquidityOneSidePrecise",
      "setPreActivationDuration",
      "setPreActivationSwapAddress"
    ]
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
  
  // Launch browser
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--disable-gpu'
    ]
  });
  
  try {
    // Load previously seen transactions
    const lastSeenTxs = await loadLastSeenTransactions();
    
    for (const instruction of CONFIG.solana.instructionsToMonitor) {
      console.log(`Checking for transactions with instruction: ${instruction}`);
      
      try {
        // Create a new page for each instruction
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
        
        // Set smaller viewport to reduce memory usage
        await page.setViewport({ width: 1280, height: 800 });
        
        // Navigate to the specific instruction URL
        const url = `https://solscan.io/account/${CONFIG.solana.programAddress}?instruction=${instruction}`;
        console.log(`Navigating to ${url}`);
        
        // Navigate with longer timeout and wait for content to load
        await page.goto(url, { 
          waitUntil: 'networkidle2',
          timeout: 90000 // 90 second timeout
        });
        
        // Wait for the transaction table to load
        // Some pages might take longer, so we'll use a try/catch
        let tableLoaded = false;
        try {
          await page.waitForSelector('table tbody tr', { timeout: 30000 });
          tableLoaded = true;
        } catch (err) {
          console.log(`No transaction table found for instruction ${instruction}`);
        }
        
        let transactions = [];
        
        if (tableLoaded) {
          // Extract transaction data
          transactions = await page.evaluate(() => {
            const result = [];
            const rows = document.querySelectorAll('table tbody tr');
            
            rows.forEach(row => {
              // Extract transaction ID from the signature column
              const txIdElement = row.querySelector('a[href^="/tx/"]');
              if (!txIdElement) return;
              
              const txUrl = txIdElement.getAttribute('href');
              const txId = txUrl.replace('/tx/', '');
              
              // Extract timestamp (second column typically)
              const timestampElement = row.querySelector('td:nth-child(2)');
              const timestamp = timestampElement ? timestampElement.textContent.trim() : 'Unknown';
              
              result.push({
                id: txId,
                timestamp: timestamp,
                url: `https://solscan.io${txUrl}`
              });
            });
            
            return result;
          });
          
          console.log(`Found ${transactions.length} transactions for instruction ${instruction}`);
        }
        
        // Close the page to free up memory
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
        
      } catch (error) {
        console.error(`Error processing instruction ${instruction}:`, error);
      }
      
      // Add a short delay between instructions to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 5000));
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