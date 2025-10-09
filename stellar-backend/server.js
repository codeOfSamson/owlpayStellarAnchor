import express from 'express';
import cors from 'cors';
import pkg from '@stellar/typescript-wallet-sdk';
const { Wallet, SigningKeypair, DomainSigner } = pkg;
import { 
    Keypair, 
    WebAuth,
    Transaction
} from '@stellar/stellar-sdk';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Enable CORS for your frontend
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173' || 'https://sarhdm-ip-220-133-81-12.tunnelmole.net/',
    credentials: true
}));

app.use(express.json());

const wallet = Wallet.TestNet();


app.get('/.well-known/stellar.toml', (req, res) => {
    res.type('text/plain');
    res.sendFile('/.well-known/stellar.toml', { root: '.' });
});

// Fetch Stellar TOML file
async function fetchStellarToml(homeDomain) {
    const tomlUrl = `https://${homeDomain}/.well-known/stellar.toml`;
    const response = await fetch(tomlUrl);
    
    if (!response.ok) {
        throw new Error(`Failed to fetch TOML file from ${tomlUrl}`);
    }
    
    const tomlText = await response.text();
    
    // Parse TOML manually (simple key=value parser)
    const tomlData = {};
    tomlText.split('\n').forEach(line => {
        line = line.trim();
        if (line && !line.startsWith('#')) {
            const [key, ...valueParts] = line.split('=');
            if (key && valueParts.length) {
                const value = valueParts.join('=').trim().replace(/['"]/g, '');
                tomlData[key.trim()] = value;
            }
        }
    });
    
    return tomlData;
}

// Get challenge transaction from anchor
async function getChallengeTransaction({ publicKey, homeDomain, clientDomain }) {
    const toml = await fetchStellarToml(homeDomain);
    
    const webAuthEndpoint = toml.WEB_AUTH_ENDPOINT || toml.TRANSFER_SERVER;
    const signingKey = toml.SIGNING_KEY;
    
    if (!webAuthEndpoint || !signingKey) {
        throw new Error('Anchor TOML missing WEB_AUTH_ENDPOINT or SIGNING_KEY');
    }
    
    // Build query parameters
    const params = new URLSearchParams({ account: publicKey });
    if (clientDomain) {
        console.log('Requesting challenge with client_domain:', clientDomain);
        params.append('client_domain', clientDomain);
    }
    
    console.log('Challenge request URL:', `${webAuthEndpoint}?${params}`);
    
    const response = await fetch(`${webAuthEndpoint}?${params}`);
    const json = await response.json();
    
    if (!response.ok) {
        throw new Error(json.error || 'Failed to get challenge transaction');
    }
    
    console.log('Challenge received, network:', json.network_passphrase);
    
    // Validate the challenge transaction
    try {
        console.log('Validating with:');
        console.log('  - homeDomain:', homeDomain);
        console.log('  - clientDomain:', clientDomain || homeDomain);
        
        const results = WebAuth.readChallengeTx(
            json.transaction,
            signingKey,
            json.network_passphrase,
            homeDomain,
            homeDomain
        );
        
        console.log('Challenge validation results:', results);
        
        if (results.clientAccountID !== publicKey) {
            throw new Error('Challenge transaction client account does not match');
        }
    } catch (err) {
        console.error('Validation error details:', err);
        throw new Error(`Challenge validation failed: ${err.message}`);
    }
    
    return {
        transaction: json.transaction,
        networkPassphrase: json.network_passphrase,
        webAuthEndpoint,
    };
}

// Submit signed challenge transaction
async function submitChallengeTransaction({ transactionXDR, webAuthEndpoint }) {
    console.log('Submitting signed challenge to:', webAuthEndpoint);
    console.log('Transaction XDR:', transactionXDR);
    
    const response = await fetch(webAuthEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transaction: transactionXDR })
    });
    
    const json = await response.json();
    
    console.log('Anchor response status:', response.status);
    console.log('Anchor response:', json);
    
    if (!response.ok) {
        const errorMsg = json.error || json.message || 'Failed to submit challenge transaction';
        console.error('Anchor error details:', JSON.stringify(json, null, 2));
        throw new Error(errorMsg);
    }
    
    return json.token;
}

// SEP-10 Authentication endpoint (Manual method without Wallet SDK)
// app.post('/api/auth/sep10', async (req, res) => {
//     try {
//         const { secretKey, homeDomain, clientDomain } = req.body;

//         if (!secretKey || !homeDomain) {
//             return res.status(400).json({ 
//                 error: 'Missing required fields: secretKey and homeDomain' 
//             });
//         }

//         console.log('Starting SEP-10 authentication for:', homeDomain);
//         if (clientDomain) {
//             console.log('Using client domain:', clientDomain);
//         }

//         // Create keypair from secret
//         const keypair = Keypair.fromSecret(secretKey);
//         const publicKey = keypair.publicKey();
        
//         console.log('Public key:', publicKey);

//         // Step 1: Get challenge transaction from anchor
//         const { transaction, networkPassphrase, webAuthEndpoint } = await getChallengeTransaction({
//             publicKey,
//             homeDomain,
//             clientDomain
//         });
        
//         console.log('Received challenge transaction');

//         // Step 2: Sign the challenge transaction with user's key
//         const txBuilder = TransactionBuilder.fromXDR(transaction, networkPassphrase);
//         txBuilder.sign(keypair);
        
//         // Step 3: If client_domain is provided, also sign with client domain key
//         if (clientDomain && process.env.CLIENT_DOMAIN_SECRET) {
//             console.log('Signing with client domain key');
//             const clientDomainKeypair = Keypair.fromSecret(process.env.CLIENT_DOMAIN_SECRET);
//             txBuilder.sign(clientDomainKeypair);
//         } else if (clientDomain && !process.env.CLIENT_DOMAIN_SECRET) {
//             console.warn('Warning: clientDomain provided but CLIENT_DOMAIN_SECRET not set in environment');
//         }
        
//         const signedTransaction = txBuilder.toXDR();
        
//         console.log('Challenge transaction signed');

//         // Step 4: Submit signed transaction and get JWT token
//         const token = await submitChallengeTransaction({
//             transactionXDR: signedTransaction,
//             webAuthEndpoint
//         });

//         console.log('Authentication successful');
//         console.log('Token type:', typeof token);
//         console.log('Token value:', token);

//         res.json({ 
//             success: true,
//             token: token,
//             clientDomainUsed: !!clientDomain,
//             message: 'Authentication successful'
//         });

//     } catch (error) {
//         console.error('Authentication error:', error);
//         res.status(500).json({ 
//             error: 'Authentication failed',
//             message: error.message,
//             details: error.toString()
//         });
//     }
// });


// SEP-10 Authentication endpoint (Wallet SDK with client domain support)
app.post('/api/auth/sep10', async (req, res) => {
    try {
        const { secretKey, homeDomain, clientDomain, backendUrl } = req.body;

        if (!secretKey || !homeDomain || !backendUrl) {
            return res.status(400).json({ 
                error: 'Missing required fields: secretKey and homeDomain' 
            });
        }

        console.log('Starting SEP-10 authentication for:', homeDomain);

        // Create anchor and user keypair
        const anchor = wallet.anchor({ homeDomain });
        const authKey = SigningKeypair.fromSecret(secretKey);
        const sep10 = await anchor.sep10();
        
        let authToken;
        
        // If client domain is provided, use domain signing
        if (clientDomain) {
          const backendSigner = new DomainSigner(
           `${backendUrl}/sign`,
           { Authorization: `Bearer ${authToken}`},
         );
            if (!process.env.CLIENT_DOMAIN_SECRET) {
                return res.status(400).json({
                    error: 'Client domain requested but CLIENT_DOMAIN_SECRET not configured'
                });
            }

                    authToken = await sep10.authenticate({
                        accountKp: authKey,
                        walletSigner: backendSigner,
                        clientDomain: clientDomain
                    });

            console.log('✅ Authentication successful with client domain');
        } else {
            // Basic authentication without client domain
            console.log('Using basic authentication (no client domain)');
            authToken = await sep10.authenticate({ accountKp: authKey });
            console.log('✅ Authentication successful (basic)');
        }

        console.log('Token received, type:', typeof authToken);

        res.json({ 
            success: true,
            token: authToken,
            clientDomainUsed: !!clientDomain,
            message: 'Authentication successful'
        });

    } catch (error) {
        console.error('❌ Authentication error:', error);
        console.error('Error details:', error.response?.data || error.message);
        res.status(500).json({ 
            error: 'Authentication failed',
            message: error.message,
            details: error.response?.data || error.toString()
        });
    }
});

// Client domain signing endpoint (for remote domain signing)
app.post('/sign', (req, res) => {
    try {
        console.log('made it to /sign endpoint', req.body);
        const { transactionXDR, networkPassphrase } = req.body;

        if (!transactionXDR || !networkPassphrase) {
            return res.status(400).json({ 
                error: 'Missing transaction or network_passphrase' 
            });
        }
        
        // Parse the transaction
        const transaction = new Transaction(transactionXDR, networkPassphrase);

        // Verify it's a SEP-10 challenge (sequence should be 0)
        if (Number.parseInt(transaction.sequence, 10) !== 0) {
            return res.status(400).json({ 
                error: 'transaction sequence value must be 0 for SEP-10' 
            });
        }
        
        if (!process.env.CLIENT_DOMAIN_SECRET) {
            return res.status(500).json({ 
                error: 'CLIENT_DOMAIN_SECRET not configured' 
            });
        }
        
        // Sign with client domain key
        const clientDomainKeypair = Keypair.fromSecret(process.env.CLIENT_DOMAIN_SECRET);
        transaction.sign(clientDomainKeypair);
        
        console.log('Signed transaction with client domain key');
        
        res.json({
            transaction: transaction.toEnvelope().toXDR('base64'),
            network_passphrase: networkPassphrase
        });
        
    } catch (error) {
        console.error('Signing error:', error);
        res.status(500).json({ 
            error: 'Failed to sign transaction',
            message: error.message 
        });
    }
});

// Get anchor info endpoint
app.post('/api/anchor/info', async (req, res) => {
    try {
        const { homeDomain } = req.body;

        if (!homeDomain) {
            return res.status(400).json({ 
                error: 'Missing required field: homeDomain' 
            });
        }

        const anchor = wallet.anchor({ homeDomain });
        const info = await anchor.getInfo();
        
        res.json({ 
            success: true,
            info,
            message: 'Anchor info retrieved'
        });

    } catch (error) {
        console.error('Anchor info error:', error);
        res.status(500).json({ 
            error: 'Failed to get anchor info',
            message: error.message
        });
    }
});

// Helper function to validate and get asset currency
async function getAssetCurrency(anchor, assetCode) {
    const info = await anchor.getInfo();
    const currency = info.currencies.find(({ code }) => code === assetCode);
    
    if (!currency?.code || !currency?.issuer) {
        throw new Error(
            `Anchor does not support ${assetCode} asset or is not correctly configured on TOML file`
        );
    }
    
    return currency;
}

// Generic SEP-24 transaction endpoint (handles both deposit and withdraw)
app.post('/api/sep24/transaction', async (req, res) => {
    try {
        const {
            homeDomain,
            authToken,
            transactionType, // 'deposit' or 'withdraw'
            assetCode,
            account, // destinationAccount for deposit, withdrawalAccount for withdraw
            amount,
            lang = 'en'
        } = req.body;

        // Validate required fields
        if (!homeDomain || !authToken || !transactionType || !assetCode || !account) {
            return res.status(400).json({
                error: 'Missing required fields',
                required: ['homeDomain', 'authToken', 'transactionType', 'assetCode', 'account']
            });
        }

        // Validate transaction type
        if (!['deposit', 'withdraw'].includes(transactionType)) {
            return res.status(400).json({
                error: 'Invalid transaction type',
                message: 'transactionType must be "deposit" or "withdraw"'
            });
        }

        console.log(`Starting ${transactionType} for ${assetCode}`);
        console.log('Auth token ', authToken);

        // Create anchor and validate asset
        const anchor = wallet.anchor({ homeDomain });
        await getAssetCurrency(anchor, assetCode);

        // Build common parameters
        const commonParams = {
            assetCode,
            authToken,
            lang,
            extraFields: amount ? { amount } : {}
        };

        console.log('Calling anchor SEP-24 endpoint...');

        // Call appropriate method based on transaction type
        const sep24 = anchor.sep24();
        let result;

        try {
            if (transactionType === 'deposit') {
                result = await sep24.deposit({
                    ...commonParams,
                    destinationAccount: account
                });
            } else {
                result = await sep24.withdraw({
                    ...commonParams,
                    withdrawalAccount: account
                });
            }
        } catch (anchorError) {
            console.error('Anchor rejected request:', anchorError);
            console.error('Anchor error details:', {
                message: anchorError.message,
                response: anchorError.response?.data,
                status: anchorError.response?.status
            });
            throw anchorError;
        }

        console.log(`${transactionType} initiated:`, result.id);

        res.json({
            success: true,
            transactionType,
            url: result.url,
            id: result.id,
            message: `${transactionType} transaction initiated successfully`
        });

    } catch (error) {
        console.error('SEP-24 transaction error:', error);
        res.status(500).json({
            error: 'Transaction failed',
            message: error.message,
            details: error.response?.data || error.toString()
        });
    }
});



// Get transaction status (SEP-24 polling endpoint)
app.post('/api/sep24/transaction/status', async (req, res) => {
    try {
        const { id, homeDomain, authToken } = req.body;

        if (!id || !homeDomain || !authToken) {
            return res.status(400).json({
                error: 'Missing required fields',
                required: ['id', 'homeDomain', 'authToken']
            });
        }

        console.log('Checking transaction status:', id);

        // Create anchor object
        const anchor = wallet.anchor({ homeDomain });
        
        // Get transaction info from anchor
        const sep24 = anchor.sep24();
        const transaction = await sep24.getTransactionBy({
            authToken,
            id
        });

        console.log('Transaction status:', transaction.status);

        res.json({
            success: true,
            transaction,
            message: 'Transaction status retrieved'
        });

    } catch (error) {
        console.error('Transaction status error:', error);
        res.status(500).json({
            error: 'Failed to get transaction status',
            message: error.message,
            details: error.response?.data || error.toString()
        });
    }
});

// Get all transactions for a user
app.post('/api/sep24/transactions/list', async (req, res) => {
    try {
        const { homeDomain, authToken, assetCode } = req.body;

        if (!homeDomain || !authToken || !assetCode) {
            return res.status(400).json({
                error: 'Missing required fields',
                required: ['homeDomain', 'authToken', 'assetCode']
            });
        }

        console.log('Getting all transactions for asset:', assetCode);

        const anchor = wallet.anchor({ homeDomain });
        const sep24 = anchor.sep24();
        
        const transactions = await sep24.getTransactionsForAsset({
            authToken,
            assetCode
        });

        res.json({
            success: true,
            transactions,
            message: 'Transactions retrieved'
        });

    } catch (error) {
        console.error('Transactions error:', error);
        res.status(500).json({
            error: 'Failed to get transactions',
            message: error.message,
            details: error.response?.data || error.toString()
        });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
});