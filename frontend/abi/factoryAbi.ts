export const FACTORY_ABI = [
  "function createToken(string memory _name, string memory _symbol, string memory _metadataURI) returns (address)",
  "function getTokenCount() view returns (uint256)",
  "function getTokensByCreator(address creator) view returns (address[])",
  "function getTokenInfo(uint256 index) view returns (tuple(address tokenAddress, string name, string symbol, uint256 totalSupply, string metadataURI, address creator, uint256 createdAt))",
  "function getAllTokens() view returns (tuple(address tokenAddress, string name, string symbol, uint256 totalSupply, string metadataURI, address creator, uint256 createdAt)[])",
  "function isToken(address) view returns (bool)",
  "event TokenCreated(address indexed tokenAddress, address indexed creator, string name, string symbol, uint256 totalSupply, string metadataURI)"
] as const;

export const TOKEN_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function transferFrom(address from, address to, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function metadataURI() view returns (string)",
  "function creator() view returns (address)",
  "function getCurrentPrice() view returns (uint256)",
  "function getBuyPrice(uint256 amount) view returns (uint256)",
  "function getSellPrice(uint256 amount) view returns (uint256)",
  "function getTradeFees(uint256 amount) view returns (uint256 creatorFee, uint256 protocolFee, uint256 totalFee)",
  "function isForSale() view returns (bool)",
  "function buyTokens(uint256 amount) payable",
  "function sellTokens(uint256 amount)",
  "function setSaleStatus(bool _isForSale)",
  "function getAvailableTokens() view returns (uint256)",
  "function getContractBalance() view returns (uint256)",
  "function getBondingProgress() view returns (uint256)",
  "function soldSupply() view returns (uint256)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "event Approval(address indexed owner, address indexed spender, uint256 value)",
  "event TokenPurchased(address indexed buyer, uint256 totalPrice, uint256 newPrice)",
  "event TokenSold(address indexed seller, uint256 totalPrice, uint256 newPrice)"
] as const;

export const FACTORY_ADDRESS = "0xcd5352dFdDad49224518F1F51aa63112243298F4";
