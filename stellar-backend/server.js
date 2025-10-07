import express from 'express';
import cors from 'cors';
import pkg from '@stellar/typescript-wallet-sdk';
const { Wallet, SigningKeypair } = pkg;
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Enable CORS for your frontend
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true
}));

app.use(express.json());

const wallet = Wallet.TestNet();

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'Server is running' });
});

// SEP-10 Authentication endpoint (using Wallet SDK)
app.post('/api/auth/sep10', async (req, res) => {
    try {
        const { secretKey, homeDomain } = req.body;

        if (!secretKey || !homeDomain) {
            return res.status(400).json({ 
                error: 'Missing required fields: secretKey and homeDomain' 
            });
        }

        console.log('Starting SEP-10 authentication for:', homeDomain);

        // Use Wallet SDK for authentication
        const anchor = wallet.anchor({ homeDomain });
        const authKey = SigningKeypair.fromSecret(secretKey);
        const sep10 = await anchor.sep10();
        const authToken = await sep10.authenticate({ accountKp: authKey });

        console.log('Authentication successful');
        console.log('Token type:', typeof authToken);

        res.json({ 
            success: true,
            token: authToken,
            message: 'Authentication successful'
        });

    } catch (error) {
        console.error('Authentication error:', error);
        res.status(500).json({ 
            error: 'Authentication failed',
            message: error.message,
            details: error.response?.data || error.toString()
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
        console.log('Auth token length:', authToken?.length);

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