import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
//import axios from 'axios'
//import { walletSdk, Wallet, SigningKeypair, DefaultSigner, DomainSigner, ApplicationConfiguration, StellarConfiguration } from '@stellar/typescript-wallet-sdk'


const AUTH_SECRET_KEY = import.meta.env.VITE_AUTH_SECRET_KEY;
const WP_ACCESS_HOST = import.meta.env.VITE_WP_ACCESS_HOST;
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
const CLIENT_DOMAIN = import.meta.env.VITE_CLIENT_DOMAIN || 'http://localhost:3001';





function App() {
  const [count, setCount] = useState(0)
  const [authToken, setAuthToken] = useState(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isDepositing, setIsDepositing] = useState(false);
  const [transactionData, setTransactionData] = useState(null);
  const [currentTransactionStatus, setCurrentTransactionStatus] = useState(null);
  const [error, setError] = useState(null);

  //Attempted to call anchor from FE but got CORS error
//   const customClient = axios.create({
//     timeout: 1000,
//   });
//   let appConfig = new ApplicationConfiguration(DefaultSigner, customClient);
//   let wallet = new Wallet({
//     stellarConfiguration: StellarConfiguration.TestNet(),
//     applicationConfiguration: appConfig,
//   });

//  const anchor = wallet.anchor({ homeDomain: WP_ACCESS_HOST });

const handleAuthenticate = async () => {
    setIsAuthenticating(true);
    setError(null);
  try {

        const response = await fetch(`${BACKEND_URL}/api/auth/sep10`, {
            method: 'POST',
               headers: {
                'Content-Type': 'application/json',
            },
              body: JSON.stringify({
              secretKey: AUTH_SECRET_KEY,
              homeDomain: WP_ACCESS_HOST,
              clientDomain: CLIENT_DOMAIN,
              backendUrl: BACKEND_URL
    })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Authentication failed');
        }
        setAuthToken(data.token);

        console.log('Auth successful!', data);
    } catch (error) {
        console.error('❌ Auth failed:', error);
        setError(error.message);
    } finally {
        setIsAuthenticating(false);
    }
  };


const handleTransaction = async (transactionType) => {
    setIsDepositing(true);
    setError(null);

    try {

        const response = await fetch(`${BACKEND_URL}/api/sep24/transaction`, {
            method: 'POST',
               headers: {
                'Content-Type': 'application/json',
            },
              body: JSON.stringify({
              homeDomain: WP_ACCESS_HOST,
              authToken: authToken,
              transactionType: transactionType,
              assetCode: 'USDC',
              account: 'GA5MGK4QGVM5ZCFLAJEKRKECPMEI44SIP4XBI6JB5MFLQO5NDHU67VWX', 
              amount: '100.00'
    })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Authentication failed');
        }

        setTransactionData(data);
        console.log('Transaction successful!', data);
    } catch (error) {
        console.error('Transaction failed:', error);
        setError(error.message);
    } finally {
        setIsDepositing(false);
    }
  }

const handleCheckTransactionStatus = async () => {
    setError(null);
    
    try {
        console.log('Checking status for transaction:', transactionData.id);

        const response = await fetch(`${BACKEND_URL}/api/sep24/transaction/status`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                id: transactionData.id, // Changed from transactionId
                authToken: authToken,
                homeDomain: WP_ACCESS_HOST
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Status check failed');
        }
        setCurrentTransactionStatus(data);
        console.log('Status retrieved!', data);
    } catch (error) {
        console.error('Status check failed:', error);
        setError(error.message);
    }
}

  const handleLogout = () => {
    setAuthToken(null);
    setError(null);
  }

  return (
    <>
      <div>
        <a href="https://vite.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      
      <h1>Stellar Wallet Demo</h1>
      <p>SEP-10 Authentication & SEP-24 Transaction</p>
      
      <div className="card">
        <button onClick={() => setCount((count) => count + 1)}>
          count is ${count}
        </button>
      </div>

      <div className="card">
        {!authToken ? (
          <button 
            onClick={handleAuthenticate}
            disabled={isAuthenticating}
            style={{
              padding: '12px 24px',
              fontSize: '16px',
              cursor: isAuthenticating ? 'not-allowed' : 'pointer',
              opacity: isAuthenticating ? 0.6 : 1
            }}
          >
            {isAuthenticating ? "🔄 Authenticating..." : "🔐 Authenticate with SEP-10"}
          </button>
        ) : (
          <div>
            <div style={{ 
              marginBottom: '16px', 
              padding: '16px', 
              background: '#d4edda',
              border: '1px solid #c3e6cb',
              borderRadius: '8px',
              color: '#155724'
            }}>
              <strong>✅ Authentication Successful!</strong>
              <p style={{ margin: '8px 0 0 0', fontSize: '14px' }}>
                You are now authenticated with {WP_ACCESS_HOST}
              </p>
            </div>
            
            <details style={{ 
              marginTop: '12px', 
              textAlign: 'left',
              background: '#f8f9fa',
              padding: '12px',
              borderRadius: '8px'
            }}>
              <summary style={{ 
                cursor: 'pointer', 
                fontWeight: 'bold',
                marginBottom: '8px'
              }}>
                📋 View JWT Token
              </summary>
              <pre style={{ 
                background: '#fff', 
                padding: '12px', 
                borderRadius: '4px',
                fontSize: '11px',
                wordBreak: 'break-all',
                whiteSpace: 'pre-wrap',
                border: '1px solid #dee2e6',
                maxHeight: '200px',
                overflow: 'auto'
              }}>
                {JSON.stringify(authToken, null, 2)}
              </pre>
            </details>
            <button 
              onClick={(e) => handleTransaction('deposit', e)}
              style={{
                marginTop: '16px',
                marginRight: '8px',
                padding: '10px 20px',
                fontSize: '14px',
                background: '#5e8cdbff',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              💰 Deposit $100 USDC
            </button>
            <button 
              onClick={(e) => handleTransaction('withdraw', e)}
              style={{
                marginTop: '16px',
                padding: '10px 20px',
                fontSize: '14px',
                background: '#5e8cdbff',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              💰 Withdraw $100 USDC
            </button>
            <details style={{ 
              marginTop: '12px', 
              textAlign: 'left',
              background: '#f8f9fa',
              padding: '12px',
              borderRadius: '8px'
            }}>
              <summary style={{ 
                cursor: 'pointer', 
                fontWeight: 'bold',
                marginBottom: '8px'
              }}>
                📋 Transaction Result
              </summary>
              <pre style={{ 
                background: '#fff', 
                padding: '12px', 
                borderRadius: '4px',
                fontSize: '11px',
                wordBreak: 'break-all',
                whiteSpace: 'pre-wrap',
                border: '1px solid #dee2e6',
                maxHeight: '200px',
                overflow: 'auto'
              }}>
                {JSON.stringify(transactionData, null, 2)}
              </pre>
            </details>
              <button 
              onClick={(e) => handleCheckTransactionStatus(e)}
              style={{
                marginTop: '16px',
                padding: '10px 20px',
                fontSize: '14px',
                background: '#5e8cdbff',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              🔄 Check Transaction Status
            </button>
            <details style={{ 
              marginTop: '12px', 
              textAlign: 'left',
              background: '#f8f9fa',
              padding: '12px',
              borderRadius: '8px'
            }}>
              <summary style={{ 
                cursor: 'pointer', 
                fontWeight: 'bold',
                marginBottom: '8px'
              }}>
                📋 Transaction Status
              </summary>
              <pre style={{ 
                background: '#fff', 
                padding: '12px', 
                borderRadius: '4px',
                fontSize: '11px',
                wordBreak: 'break-all',
                whiteSpace: 'pre-wrap',
                border: '1px solid #dee2e6',
                maxHeight: '200px',
                overflow: 'auto'
              }}>
                {JSON.stringify(currentTransactionStatus, null, 2)}
              </pre>
            </details>


            <button 
              onClick={handleLogout}
              style={{
                marginTop: '16px',
                padding: '10px 20px',
                fontSize: '14px',
                background: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              🚪 Logout
            </button>
          </div>
        )}
        
        {error && (
          <div style={{ 
            marginTop: '16px', 
            padding: '12px',
            background: '#f8d7da',
            border: '1px solid #f5c6cb',
            borderRadius: '8px',
            color: '#721c24'
          }}>
            <strong>❌ Authentication Error</strong>
            <p style={{ margin: '8px 0 0 0', fontSize: '14px' }}>
              {error}
            </p>
          </div>
        )}
      </div>

      <div style={{ 
        marginTop: '40px', 
        padding: '16px',
        fontSize: '12px', 
        color: '#6c757d',
        background: '#f8f9fa',
        borderRadius: '8px',
        border: '1px solid #dee2e6'
      }}>
        <h3 style={{ marginTop: 0, fontSize: '14px', color: '#495057' }}>
          🔧 Configuration
        </h3>
        <p style={{ margin: '4px 0' }}>
          <strong>Anchor Domain:</strong> {WP_ACCESS_HOST || '(not set)'}
        </p>
        <p style={{ margin: '4px 0' }}>
          <strong>Backend URL:</strong> {BACKEND_URL}
        </p>
        <p style={{ margin: '4px 0' }}>
          <strong>Secret Key:</strong> {AUTH_SECRET_KEY ? '✓ Set' : '❌ Not set'}
        </p>
      </div>
    </>
  )
}

export default App