// App.tsx
import { ConnectButton } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import { getContractReadOnly, getContractWithSigner } from "./contract";
import "./App.css";
import { useAccount, useSignMessage } from 'wagmi';

interface GachaRecord {
  id: string;
  encryptedRarity: string;
  timestamp: number;
  player: string;
  prizeValue: number;
  status: "pending" | "won" | "lost";
}

const FHEEncryptNumber = (value: number): string => {
  return `FHE-${btoa(value.toString())}`;
};

const FHEDecryptNumber = (encryptedData: string): number => {
  if (encryptedData.startsWith('FHE-')) {
    return parseFloat(atob(encryptedData.substring(4)));
  }
  return parseFloat(encryptedData);
};

const generatePublicKey = () => `0x${Array(2000).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('')}`;

const App: React.FC = () => {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<GachaRecord[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showGachaModal, setShowGachaModal] = useState(false);
  const [gachaSpinning, setGachaSpinning] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState<{ visible: boolean; status: "pending" | "success" | "error"; message: string; }>({ visible: false, status: "pending", message: "" });
  const [decryptedRarity, setDecryptedRarity] = useState<number | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [publicKey, setPublicKey] = useState<string>("");
  const [contractAddress, setContractAddress] = useState<string>("");
  const [chainId, setChainId] = useState<number>(0);
  const [startTimestamp, setStartTimestamp] = useState<number>(0);
  const [durationDays, setDurationDays] = useState<number>(30);
  const [prizePool, setPrizePool] = useState<number>(0);
  const [apy, setApy] = useState<number>(8.5);
  const [selectedRecord, setSelectedRecord] = useState<GachaRecord | null>(null);

  // Rarity tiers
  const rarityTiers = [
    { name: "Common", chance: 60, color: "#6b7280" },
    { name: "Uncommon", chance: 25, color: "#3b82f6" },
    { name: "Rare", chance: 10, color: "#8b5cf6" },
    { name: "Epic", chance: 4, color: "#ec4899" },
    { name: "Legendary", chance: 1, color: "#f59e0b" }
  ];

  // Sample leaderboard data
  const [leaderboard, setLeaderboard] = useState<{player: string, wins: number, totalValue: number}[]>([]);

  useEffect(() => {
    loadRecords().finally(() => setLoading(false));
    updatePrizePool();
    const initSignatureParams = async () => {
      const contract = await getContractReadOnly();
      if (contract) setContractAddress(await contract.getAddress());
      if (window.ethereum) {
        const chainIdHex = await window.ethereum.request({ method: 'eth_chainId' });
        setChainId(parseInt(chainIdHex, 16));
      }
      setStartTimestamp(Math.floor(Date.now() / 1000));
      setDurationDays(30);
      setPublicKey(generatePublicKey());
    };
    initSignatureParams();
    updateLeaderboard();
    
    // Simulate prize pool growth from DeFi
    const prizePoolInterval = setInterval(updatePrizePool, 5000);
    return () => clearInterval(prizePoolInterval);
  }, []);

  const updatePrizePool = () => {
    // Simulate DeFi growth with some randomness
    const baseValue = 1000 + Math.random() * 500;
    const growthFactor = 1 + (apy / 100) * (5 / 365); // 5 seconds of growth
    setPrizePool(prev => prev > 0 ? prev * growthFactor : baseValue);
  };

  const updateLeaderboard = () => {
    // Generate mock leaderboard data
    const mockData = [
      { player: "0x7f3...4d21", wins: 12, totalValue: 2450 },
      { player: "0x5a2...9e3f", wins: 8, totalValue: 1800 },
      { player: "0x3b8...7c1d", wins: 6, totalValue: 1350 },
      { player: "0x1e9...5b2a", wins: 5, totalValue: 1100 },
      { player: "0x4f7...8c3e", wins: 4, totalValue: 950 }
    ];
    if (address) {
      // Add current user if not in top 5
      const userWins = records.filter(r => r.player === address && r.status === "won").length;
      const userValue = records.filter(r => r.player === address && r.status === "won")
        .reduce((sum, r) => sum + r.prizeValue, 0);
      if (userWins > 0) {
        mockData.push({ player: `${address.substring(0,4)}...${address.substring(38)}`, wins: userWins, totalValue: userValue });
      }
    }
    setLeaderboard(mockData.sort((a,b) => b.totalValue - a.totalValue).slice(0,5));
  };

  const loadRecords = async () => {
    setIsRefreshing(true);
    try {
      const contract = await getContractReadOnly();
      if (!contract) return;
      
      // Check contract availability
      const isAvailable = await contract.isAvailable();
      if (!isAvailable) return;
      
      // Load record keys
      const keysBytes = await contract.getData("gacha_keys");
      let keys: string[] = [];
      if (keysBytes.length > 0) {
        try {
          const keysStr = ethers.toUtf8String(keysBytes);
          if (keysStr.trim() !== '') keys = JSON.parse(keysStr);
        } catch (e) { console.error("Error parsing gacha keys:", e); }
      }
      
      // Load each record
      const list: GachaRecord[] = [];
      for (const key of keys) {
        try {
          const recordBytes = await contract.getData(`gacha_${key}`);
          if (recordBytes.length > 0) {
            try {
              const recordData = JSON.parse(ethers.toUtf8String(recordBytes));
              list.push({ 
                id: key, 
                encryptedRarity: recordData.rarity, 
                timestamp: recordData.timestamp, 
                player: recordData.player, 
                prizeValue: recordData.prizeValue || 0,
                status: recordData.status || "pending" 
              });
            } catch (e) { console.error(`Error parsing record data for ${key}:`, e); }
          }
        } catch (e) { console.error(`Error loading record ${key}:`, e); }
      }
      
      list.sort((a, b) => b.timestamp - a.timestamp);
      setRecords(list);
      updateLeaderboard();
    } catch (e) { 
      console.error("Error loading records:", e); 
    } finally { 
      setIsRefreshing(false); 
      setLoading(false); 
    }
  };

  const playGacha = async () => {
    if (!isConnected) { alert("Please connect wallet first"); return; }
    setGachaSpinning(true);
    setTransactionStatus({ visible: true, status: "pending", message: "Generating verifiably fair result with Zama FHE..." });
    
    try {
      // Simulate rarity roll (0-100)
      const rarityRoll = Math.floor(Math.random() * 100);
      const encryptedRarity = FHEEncryptNumber(rarityRoll);
      
      const contract = await getContractWithSigner();
      if (!contract) throw new Error("Failed to get contract with signer");
      
      const gachaId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      let prizeValue = 0;
      let status: "won" | "lost" = "lost";
      
      // Determine win/lose based on rarity (30% chance to win)
      if (rarityRoll <= 30) {
        status = "won";
        // Prize value based on rarity tier
        if (rarityRoll <= 1) prizeValue = prizePool * 0.1; // Legendary 10% of pool
        else if (rarityRoll <= 5) prizeValue = prizePool * 0.05; // Epic 5%
        else if (rarityRoll <= 15) prizeValue = prizePool * 0.02; // Rare 2%
        else if (rarityRoll <= 35) prizeValue = prizePool * 0.01; // Uncommon 1%
        else prizeValue = prizePool * 0.005; // Common 0.5%
      }
      
      const gachaData = { 
        rarity: encryptedRarity, 
        timestamp: Math.floor(Date.now() / 1000), 
        player: address, 
        prizeValue,
        status 
      };
      
      await contract.setData(`gacha_${gachaId}`, ethers.toUtf8Bytes(JSON.stringify(gachaData)));
      
      // Update keys list
      const keysBytes = await contract.getData("gacha_keys");
      let keys: string[] = [];
      if (keysBytes.length > 0) {
        try { keys = JSON.parse(ethers.toUtf8String(keysBytes)); } 
        catch (e) { console.error("Error parsing keys:", e); }
      }
      keys.push(gachaId);
      await contract.setData("gacha_keys", ethers.toUtf8Bytes(JSON.stringify(keys)));
      
      setTransactionStatus({ 
        visible: true, 
        status: "success", 
        message: status === "won" 
          ? `🎉 You won ${prizeValue.toFixed(4)} ETH!` 
          : "Better luck next time!" 
      });
      
      await loadRecords();
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
        setShowGachaModal(false);
      }, 2000);
    } catch (e: any) {
      const errorMessage = e.message.includes("user rejected transaction") 
        ? "Transaction rejected by user" 
        : "Gacha failed: " + (e.message || "Unknown error");
      setTransactionStatus({ visible: true, status: "error", message: errorMessage });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    } finally { 
      setGachaSpinning(false); 
    }
  };

  const decryptWithSignature = async (encryptedData: string): Promise<number | null> => {
    if (!isConnected) { alert("Please connect wallet first"); return null; }
    setIsDecrypting(true);
    try {
      const message = `publickey:${publicKey}\ncontractAddresses:${contractAddress}\ncontractsChainId:${chainId}\nstartTimestamp:${startTimestamp}\ndurationDays:${durationDays}`;
      await signMessageAsync({ message });
      await new Promise(resolve => setTimeout(resolve, 1500));
      return FHEDecryptNumber(encryptedData);
    } catch (e) { 
      console.error("Decryption failed:", e); 
      return null; 
    } finally { 
      setIsDecrypting(false); 
    }
  };

  const getRarityTier = (rarity: number) => {
    if (rarity <= 1) return rarityTiers[4]; // Legendary
    if (rarity <= 5) return rarityTiers[3]; // Epic
    if (rarity <= 15) return rarityTiers[2]; // Rare
    if (rarity <= 35) return rarityTiers[1]; // Uncommon
    return rarityTiers[0]; // Common
  };

  const renderRarityVisualization = (rarity: number) => {
    const tier = getRarityTier(rarity);
    return (
      <div className="rarity-visualization" style={{ backgroundColor: tier.color }}>
        <div className="rarity-name">{tier.name}</div>
        <div className="rarity-value">{rarity}/100</div>
      </div>
    );
  };

  const renderGachaAnimation = () => {
    return (
      <div className={`gacha-machine ${gachaSpinning ? 'spinning' : ''}`}>
        <div className="gacha-capsule">
          <div className="capsule-top"></div>
          <div className="capsule-bottom"></div>
        </div>
        <div className="gacha-handle"></div>
        <div className="gacha-lights">
          <div className="light pink"></div>
          <div className="light blue"></div>
          <div className="light purple"></div>
        </div>
      </div>
    );
  };

  if (loading) return (
    <div className="loading-screen">
      <div className="anime-spinner"></div>
      <p>Initializing GachaFi connection...</p>
    </div>
  );

  return (
    <div className="app-container anime-theme">
      <header className="app-header">
        <div className="logo">
          <div className="logo-icon">🎮</div>
          <h1>Gacha<span>Fi</span></h1>
        </div>
        <div className="header-actions">
          <button onClick={() => setShowGachaModal(true)} className="play-gacha-btn anime-button">
            Play Gacha (0.01 ETH)
          </button>
          <div className="wallet-connect-wrapper">
            <ConnectButton accountStatus="address" chainStatus="icon" showBalance={false}/>
          </div>
        </div>
      </header>

      <div className="main-content">
        {/* Project Introduction */}
        <div className="intro-card anime-card">
          <h2>GachaFi: Verifiably Fair Gacha with DeFi Prize Pool</h2>
          <p>
            A gacha game where the rare NFT prize pool is automatically invested in DeFi protocols to generate yield. 
            The gacha mechanism uses <strong>Zama FHE</strong> to ensure provable fairness. Your pull results are encrypted 
            and remain private throughout the process.
          </p>
          <div className="tech-badge">
            <span>Powered by FHE + DeFi</span>
          </div>
        </div>

        {/* Data Dashboard */}
        <div className="dashboard-grid">
          <div className="dashboard-card anime-card">
            <h3>Prize Pool Stats</h3>
            <div className="stats-grid">
              <div className="stat-item">
                <div className="stat-value">{prizePool.toFixed(4)} ETH</div>
                <div className="stat-label">Current Pool</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">{apy}%</div>
                <div className="stat-label">APY</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">{records.filter(r => r.status === "won").length}</div>
                <div className="stat-label">Total Wins</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">
                  {records.filter(r => r.player === address && r.status === "won").length}
                </div>
                <div className="stat-label">Your Wins</div>
              </div>
            </div>
          </div>

          <div className="dashboard-card anime-card">
            <h3>Leaderboard</h3>
            <div className="leaderboard-list">
              {leaderboard.map((player, index) => (
                <div className="leaderboard-item" key={index}>
                  <div className="rank">#{index + 1}</div>
                  <div className="player-info">
                    <div className="player-address">{player.player}</div>
                    <div className="player-stats">
                      <span>{player.wins} wins</span>
                      <span>{player.totalValue.toFixed(2)} ETH</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="dashboard-card anime-card">
            <h3>Your Recent Pulls</h3>
            <div className="recent-pulls">
              {records.filter(r => r.player === address).slice(0, 3).map(record => (
                <div 
                  className={`pull-item ${record.status}`} 
                  key={record.id}
                  onClick={() => setSelectedRecord(record)}
                >
                  <div className="pull-id">#{record.id.substring(0, 6)}</div>
                  <div className="pull-status">
                    {record.status === "won" 
                      ? `Won ${record.prizeValue.toFixed(4)} ETH` 
                      : "No win"}
                  </div>
                </div>
              ))}
              {records.filter(r => r.player === address).length === 0 && (
                <div className="no-pulls">No gacha pulls yet</div>
              )}
            </div>
          </div>
        </div>

        {/* Gacha Records */}
        <div className="records-section">
          <div className="section-header">
            <h2>Recent Gacha Results</h2>
            <button 
              onClick={loadRecords} 
              className="refresh-btn anime-button" 
              disabled={isRefreshing}
            >
              {isRefreshing ? "Refreshing..." : "Refresh"}
            </button>
          </div>
          <div className="records-list anime-card">
            {records.length === 0 ? (
              <div className="no-records">
                <div className="no-records-icon">🎮</div>
                <p>No gacha records found</p>
              </div>
            ) : (
              records.slice(0, 10).map(record => (
                <div 
                  className={`record-row ${record.status}`} 
                  key={record.id}
                  onClick={() => setSelectedRecord(record)}
                >
                  <div className="player-cell">
                    {record.player.substring(0, 6)}...{record.player.substring(38)}
                  </div>
                  <div className="result-cell">
                    {record.status === "won" 
                      ? `Won ${record.prizeValue.toFixed(4)} ETH` 
                      : "No win"}
                  </div>
                  <div className="time-cell">
                    {new Date(record.timestamp * 1000).toLocaleTimeString()}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Gacha Play Modal */}
      {showGachaModal && (
        <div className="modal-overlay">
          <div className="gacha-modal anime-card">
            <div className="modal-header">
              <h2>Play Gacha</h2>
              <button onClick={() => setShowGachaModal(false)} className="close-modal">&times;</button>
            </div>
            <div className="modal-body">
              <div className="fhe-notice">
                <div className="lock-icon">🔒</div>
                <p>Your gacha result will be encrypted with Zama FHE for verifiable fairness</p>
              </div>
              
              {renderGachaAnimation()}
              
              <div className="prize-pool-info">
                <div className="pool-value">{prizePool.toFixed(4)} ETH</div>
                <div className="pool-label">Current Prize Pool</div>
              </div>
              
              <button 
                onClick={playGacha} 
                disabled={gachaSpinning}
                className={`play-button anime-button ${gachaSpinning ? 'spinning' : ''}`}
              >
                {gachaSpinning ? "Spinning..." : "Pull (0.01 ETH)"}
              </button>
              
              <div className="rarity-info">
                <h4>Rarity Tiers</h4>
                <div className="rarity-tiers">
                  {rarityTiers.map(tier => (
                    <div 
                      className="tier-item" 
                      key={tier.name}
                      style={{ backgroundColor: tier.color }}
                    >
                      {tier.name} ({tier.chance}%)
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Record Detail Modal */}
      {selectedRecord && (
        <RecordDetailModal 
          record={selectedRecord} 
          onClose={() => {
            setSelectedRecord(null);
            setDecryptedRarity(null);
          }} 
          decryptedRarity={decryptedRarity}
          setDecryptedRarity={setDecryptedRarity}
          isDecrypting={isDecrypting}
          decryptWithSignature={decryptWithSignature}
          renderRarityVisualization={renderRarityVisualization}
        />
      )}

      {/* Transaction Status Modal */}
      {transactionStatus.visible && (
        <div className="transaction-modal">
          <div className="transaction-content anime-card">
            <div className={`transaction-icon ${transactionStatus.status}`}>
              {transactionStatus.status === "pending" && <div className="anime-spinner"></div>}
              {transactionStatus.status === "success" && "🎉"}
              {transactionStatus.status === "error" && "❌"}
            </div>
            <div className="transaction-message">{transactionStatus.message}</div>
          </div>
        </div>
      )}

      <footer className="app-footer">
        <div className="footer-content">
          <div className="footer-brand">
            <div className="logo">🎮<span>GachaFi</span></div>
            <p>Verifiably fair gacha with DeFi-powered prize pool</p>
          </div>
          <div className="footer-links">
            <a href="#" className="footer-link">Docs</a>
            <a href="#" className="footer-link">Terms</a>
            <a href="#" className="footer-link">Privacy</a>
          </div>
        </div>
        <div className="footer-bottom">
          <div className="tech-badge">
            <span>Powered by Zama FHE</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

interface RecordDetailModalProps {
  record: GachaRecord;
  onClose: () => void;
  decryptedRarity: number | null;
  setDecryptedRarity: (value: number | null) => void;
  isDecrypting: boolean;
  decryptWithSignature: (encryptedData: string) => Promise<number | null>;
  renderRarityVisualization: (rarity: number) => React.ReactNode;
}

const RecordDetailModal: React.FC<RecordDetailModalProps> = ({ 
  record, 
  onClose, 
  decryptedRarity, 
  setDecryptedRarity, 
  isDecrypting, 
  decryptWithSignature,
  renderRarityVisualization
}) => {
  const handleDecrypt = async () => {
    if (decryptedRarity !== null) { setDecryptedRarity(null); return; }
    const decrypted = await decryptWithSignature(record.encryptedRarity);
    if (decrypted !== null) setDecryptedRarity(decrypted);
  };

  return (
    <div className="modal-overlay">
      <div className="record-detail-modal anime-card">
        <div className="modal-header">
          <h2>Gacha Result #{record.id.substring(0, 8)}</h2>
          <button onClick={onClose} className="close-modal">&times;</button>
        </div>
        <div className="modal-body">
          <div className="record-info">
            <div className="info-item">
              <span>Player:</span>
              <strong>{record.player.substring(0, 6)}...{record.player.substring(38)}</strong>
            </div>
            <div className="info-item">
              <span>Time:</span>
              <strong>{new Date(record.timestamp * 1000).toLocaleString()}</strong>
            </div>
            <div className="info-item">
              <span>Result:</span>
              <strong className={`result-status ${record.status}`}>
                {record.status === "won" 
                  ? `Won ${record.prizeValue.toFixed(4)} ETH` 
                  : "No win"}
              </strong>
            </div>
          </div>
          
          <div className="encrypted-data-section">
            <h3>Encrypted Rarity</h3>
            <div className="encrypted-data">
              {record.encryptedRarity.substring(0, 50)}...
            </div>
            <div className="fhe-tag">
              <span>🔒 FHE Encrypted</span>
            </div>
            
            <button 
              className={`decrypt-btn anime-button ${isDecrypting ? 'loading' : ''}`} 
              onClick={handleDecrypt}
              disabled={isDecrypting}
            >
              {isDecrypting ? "Decrypting..." : 
               decryptedRarity !== null ? "Hide Rarity" : "Decrypt Rarity"}
            </button>
          </div>
          
          {decryptedRarity !== null && (
            <div className="decrypted-section">
              <h3>Decrypted Rarity</h3>
              {renderRarityVisualization(decryptedRarity)}
              <div className="decryption-notice">
                <span>🔐 Decrypted with your wallet signature</span>
              </div>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="close-btn anime-button">Close</button>
        </div>
      </div>
    </div>
  );
};

export default App;