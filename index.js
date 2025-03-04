// Fetch recent transactions using HTTP request
function fetchRecentTransactions(programAddress, instruction) {
  return new Promise((resolve, reject) => {
    // We'll use the public Solana API directly instead of scraping
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
          // Handle potential empty response
          if (!data || data.trim() === '') {
            console.log('Empty response from API');
            resolve(transactions);
            return;
          }
          
          const result = JSON.parse(data);
          
          if (Array.isArray(result)) {
            // Process each transaction
            for (const tx of result) {
              if (tx && tx.txHash) {
                transactions.push({
                  id: tx.txHash,
                  timestamp: tx.blockTime ? new Date(tx.blockTime * 1000).toLocaleString() : 'Unknown',
                  url: `https://solscan.io/tx/${tx.txHash}`
                });
              }
            }
          } else {
            console.log('Unexpected API response format:', typeof result);
          }
          
          resolve(transactions);
        } catch (error) {
          console.error('Error parsing transaction data:', error);
          console.error('Raw data received:', data.substring(0, 200) + '...');
          resolve([]);
        }
      });
    }).on('error', (error) => {
      console.error('Error fetching transactions:', error);
      resolve([]);
    });
  });
}