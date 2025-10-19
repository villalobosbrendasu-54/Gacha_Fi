pragma solidity ^0.8.24;

import { FHE, euint32, ebool } from "@fhevm/solidity/lib/FHE.sol";
import { SepoliaConfig } from "@fhevm/solidity/config/ZamaConfig.sol";


contract GachaFiFHE is SepoliaConfig {
    using FHE for euint32;
    using FHE for ebool;

    error NotOwner();
    error NotProvider();
    error Paused();
    error CooldownActive();
    error BatchClosed();
    error BatchNotClosed();
    error InvalidParameter();
    error ReplayDetected();
    error StateMismatch();
    error InvalidProof();
    error NotInitialized();

    event ProviderAdded(address indexed provider);
    event ProviderRemoved(address indexed provider);
    event PausedSet(bool paused);
    event CooldownSecondsSet(uint256 cooldownSeconds);
    event BatchOpened(uint256 batchId);
    event BatchClosed(uint256 batchId);
    event GachaSubmitted(address indexed player, uint256 indexed batchId, uint32 drawCount);
    event DecryptionRequested(uint256 indexed requestId, uint256 indexed batchId);
    event DecryptionCompleted(uint256 indexed requestId, uint256 indexed batchId, uint32 totalPrizePool);

    struct DecryptionContext {
        uint256 batchId;
        bytes32 stateHash;
        bool processed;
    }

    address public owner;
    mapping(address => bool) public isProvider;
    bool public paused;
    uint256 public cooldownSeconds;
    mapping(address => uint256) public lastSubmissionTime;
    mapping(address => uint256) public lastDecryptionRequestTime;

    uint256 public currentBatchId;
    bool public batchOpen;

    mapping(uint256 => euint32) public encryptedTotalPrizePool; // batchId -> euint32
    mapping(uint256 => euint32) public encryptedDrawCount;     // batchId -> euint32
    mapping(uint256 => mapping(address => euint32)) public encryptedPlayerDrawCounts; // batchId -> player -> euint32

    mapping(uint256 => DecryptionContext) public decryptionContexts;

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyProvider() {
        if (!isProvider[msg.sender]) revert NotProvider();
        _;
    }

    modifier whenNotPaused() {
        if (paused) revert Paused();
        _;
    }

    constructor() {
        owner = msg.sender;
        isProvider[owner] = true;
        paused = false;
        cooldownSeconds = 10; // Default cooldown
        currentBatchId = 0;
        batchOpen = false;
        emit ProviderAdded(owner);
    }

    function addProvider(address _provider) external onlyOwner {
        if (_provider == address(0)) revert InvalidParameter();
        isProvider[_provider] = true;
        emit ProviderAdded(_provider);
    }

    function removeProvider(address _provider) external onlyOwner {
        if (_provider == address(0)) revert InvalidParameter();
        delete isProvider[_provider];
        emit ProviderRemoved(_provider);
    }

    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
        emit PausedSet(_paused);
    }

    function setCooldownSeconds(uint256 _cooldownSeconds) external onlyOwner {
        if (_cooldownSeconds == 0) revert InvalidParameter();
        cooldownSeconds = _cooldownSeconds;
        emit CooldownSecondsSet(_cooldownSeconds);
    }

    function openBatch() external onlyProvider whenNotPaused {
        if (batchOpen) revert BatchNotClosed();
        currentBatchId++;
        batchOpen = true;
        // Initialize encrypted state for the new batch
        encryptedTotalPrizePool[currentBatchId] = FHE.asEuint32(0);
        encryptedDrawCount[currentBatchId] = FHE.asEuint32(0);
        emit BatchOpened(currentBatchId);
    }

    function closeBatch() external onlyProvider whenNotPaused {
        if (!batchOpen) revert BatchClosed();
        batchOpen = false;
        emit BatchClosed(currentBatchId);
    }

    function submitGachaDraw(uint32 _drawCount) external whenNotPaused {
        if (!batchOpen) revert BatchClosed();
        if (block.timestamp < lastSubmissionTime[msg.sender] + cooldownSeconds) {
            revert CooldownActive();
        }
        lastSubmissionTime[msg.sender] = block.timestamp;

        euint32 memory currentBatchEncryptedDrawCount = encryptedDrawCount[currentBatchId];
        euint32 memory playerEncryptedDrawCount = encryptedPlayerDrawCounts[currentBatchId][msg.sender];

        if (!FHE.isInitialized(currentBatchEncryptedDrawCount)) {
            currentBatchEncryptedDrawCount = FHE.asEuint32(0);
            encryptedDrawCount[currentBatchId] = currentBatchEncryptedDrawCount;
        }
        if (!FHE.isInitialized(playerEncryptedDrawCount)) {
            playerEncryptedDrawCount = FHE.asEuint32(0);
            encryptedPlayerDrawCounts[currentBatchId][msg.sender] = playerEncryptedDrawCount;
        }

        euint32 memory newPlayerDrawCount = FHE.add(playerEncryptedDrawCount, FHE.asEuint32(_drawCount));
        encryptedPlayerDrawCounts[currentBatchId][msg.sender] = newPlayerDrawCount;

        euint32 memory newBatchDrawCount = FHE.add(currentBatchEncryptedDrawCount, FHE.asEuint32(_drawCount));
        encryptedDrawCount[currentBatchId] = newBatchDrawCount;

        emit GachaSubmitted(msg.sender, currentBatchId, _drawCount);
    }

    function requestBatchDecryption() external onlyProvider whenNotPaused {
        if (batchOpen) revert BatchNotClosed(); // Ensure batch is closed
        if (block.timestamp < lastDecryptionRequestTime[msg.sender] + cooldownSeconds) {
            revert CooldownActive();
        }
        lastDecryptionRequestTime[msg.sender] = block.timestamp;

        euint32 memory totalPrizePool = encryptedTotalPrizePool[currentBatchId];
        euint32 memory totalDraws = encryptedDrawCount[currentBatchId];

        _requireInitialized(totalPrizePool);
        _requireInitialized(totalDraws);

        bytes32[] memory cts = new bytes32[](2);
        cts[0] = FHE.toBytes32(totalPrizePool);
        cts[1] = FHE.toBytes32(totalDraws);

        bytes32 stateHash = _hashCiphertexts(cts);

        uint256 requestId = FHE.requestDecryption(cts, this.myCallback.selector);
        decryptionContexts[requestId] = DecryptionContext({ batchId: currentBatchId, stateHash: stateHash, processed: false });

        emit DecryptionRequested(requestId, currentBatchId);
    }

    function myCallback(uint256 requestId, bytes memory cleartexts, bytes memory proof) public {
        DecryptionContext storage context = decryptionContexts[requestId];

        if (context.processed) revert ReplayDetected();

        euint32 memory currentTotalPrizePool = encryptedTotalPrizePool[context.batchId];
        euint32 memory currentTotalDraws = encryptedDrawCount[context.batchId];

        _requireInitialized(currentTotalPrizePool);
        _requireInitialized(currentTotalDraws);

        bytes32[] memory cts = new bytes32[](2);
        cts[0] = FHE.toBytes32(currentTotalPrizePool);
        cts[1] = FHE.toBytes32(currentTotalDraws);

        bytes32 currentHash = _hashCiphertexts(cts);
        if (currentHash != context.stateHash) {
            revert StateMismatch(); // Ensures contract state hasn't changed since request
        }

        if (!FHE.checkSignatures(requestId, cleartexts, proof)) {
            revert InvalidProof(); // Verifies FHE provider's computation
        }

        uint32 totalPrizePoolCleartext = abi.decode(cleartexts[0], (uint32));
        uint32 totalDrawsCleartext = abi.decode(cleartexts[1], (uint32));

        context.processed = true;
        emit DecryptionCompleted(requestId, context.batchId, totalPrizePoolCleartext);
    }

    function _hashCiphertexts(bytes32[] memory cts) internal pure returns (bytes32) {
        return keccak256(abi.encode(cts, address(this)));
    }

    function _initIfNeeded(euint32 storage s, uint32 val) internal {
        if (!FHE.isInitialized(s)) {
            s = FHE.asEuint32(val);
        }
    }

    function _requireInitialized(euint32 memory e) internal pure {
        if (!FHE.isInitialized(e)) {
            revert NotInitialized();
        }
    }
}