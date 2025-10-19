# GachaFi: The Verifiably Fair Gacha Game 🌟🎮

GachaFi is a groundbreaking gacha game that combines the thrill of collectible card pulling with the financial benefits of decentralized finance (DeFi). The core functionality of GachaFi is powered by **Zama's Fully Homomorphic Encryption technology**, ensuring that every pull is not only exciting but also completely fair and transparent. By utilizing state-of-the-art encryption, GachaFi guarantees that players can enjoy their gaming experience without any apprehensions about the integrity of the results.

## The Problem: Fairness in Gaming 🎲

In the gaming world, particularly within gacha mechanics, players often face skepticism regarding the fairness of random draws. Fraudulent practices, rigged systems, and lack of transparency can lead to frustration among players, discouraging participation and trust. Additionally, rewards in traditional gacha systems often lack the potential for real-world financial growth, limiting the fun to pure luck.

## How FHE Solves This Issue 🔒

GachaFi uses **Zama's Fully Homomorphic Encryption (FHE)** to ensure that both the pulling probabilities and the results of each gacha draw are cryptographically secure and verifiable. By implementing Zama's open-source libraries like **Concrete** and the **zama-fhe SDK**, we can perform computations on encrypted data without exposing it, ensuring that the chances of obtaining rare NFTs are precisely as advertised. The funds collected in the prize pool are automatically invested in robust DeFi protocols, allowing the prize pool to grow continuously, thus delivering value to players over time.

## Core Features 🌈

- **Cryptographically Secured Draws**: All gacha probabilities and outcomes are encrypted using FHE, ensuring a fair experience for every player.
- **Dynamic Prize Pool**: The prize pool funds are automatically staked in reliable DeFi protocols, generating returns that benefit the players.
- **Rare NFT Rewards**: Players can earn unique NFTs backed by real-world assets, providing tangible value along with the excitement of gaming.
- **Engaging User Interface**: Featuring a visually appealing anime and fantasy theme, the interface is designed to be user-friendly and captivating.
- **Real-time Prize Pool Growth**: Players can track the continuously growing prize pool, adding an extra layer of excitement to each draw.

## Technology Stack 🛠️

- **Zama SDK**: The main component for secure and confidential computing.
- **Ethereum**: The underlying blockchain for executing smart contracts.
- **React**: For building responsive and dynamic user interfaces.
- **Node.js**: Server-side technology used for the application backend.
- **Hardhat**: Development environment for Ethereum.

## Directory Structure 📂

```
Gacha_Fi/
├── contracts/
│   └── Gacha_Fi.sol
├── src/
│   ├── config.js
│   ├── draw.js
│   └── index.js
├── tests/
│   └── gacha.test.js
├── package.json
└── README.md
```

## Installation Guide 🛠️

To set up GachaFi, follow these instructions carefully. Please note that you are not allowed to use `git clone` or any other URLs.

1. Ensure you have **Node.js** installed on your machine. If not, download and install it from the official Node.js website.
2. Install **Hardhat** or **Foundry** as your Ethereum development environment.
3. Navigate into the GachaFi project directory via your command line.
4. Run the following command to install the necessary dependencies, including the Zama FHE libraries:

   ```bash
   npm install
   ```

## Build & Run Guide 🚀

Once the dependencies are installed, you can compile, test, and run the application with the following commands:

1. **Compile the smart contracts**:

   ```bash
   npx hardhat compile
   ```

2. **Run the tests**:

   ```bash
   npx hardhat test
   ```

3. **Deploy the smart contracts**:

   ```bash
   npx hardhat run scripts/deploy.js --network <network-name>
   ```

4. **Start the application**:

   ```bash
   npm start
   ```

Feel free to adapt the network name according to your specific deployment needs!

## Acknowledgements 🙏

GachaFi is proudly powered by Zama, whose pioneering work in Fully Homomorphic Encryption and open-source tools has made it possible to create confidential blockchain applications that redefine gaming. Special thanks to the Zama team for their relentless pursuit of innovation in the cryptography space, enabling projects like GachaFi to thrive.

---

GachaFi aims to redefine how players engage with gacha games, ensuring a fair, exciting, and rewarding experience while leveraging cutting-edge technology. Join us on this amazing journey as we transform the gaming landscape with transparency and financial growth!
