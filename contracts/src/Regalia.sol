// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Regalia: the keepsakes of Agentistan's rulers
/// @notice A plain ERC-721. The game's keeper mints a token when a player seizes a throne, wins a battle by his own
/// plan, ends a reign, or ends an era as its master. Wallets and explorers show them from tokenURI: the name, the
/// picture and the traits (the era, the realm, the reign) live at the game's /nft/<id>.
contract Regalia {
    string public constant name = "Agentistan Regalia";
    string public constant symbol = "REGALIA";
    address public immutable keeper;
    string public baseURI;

    mapping(uint256 => address) private _owners;
    mapping(address => uint256) private _balances;
    mapping(uint256 => address) private _approved;
    mapping(address => mapping(address => bool)) private _operators;

    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId);
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);

    error NotKeeper();
    error AlreadyMinted(uint256 tokenId);
    error NoSuchToken(uint256 tokenId);
    error BadAddress();
    error NotAllowed();
    error NotReceiver();

    constructor(string memory base) {
        keeper = msg.sender;
        baseURI = base;
    }

    // ---------- ERC-165 ----------
    function supportsInterface(bytes4 id) external pure returns (bool) {
        return id == 0x01ffc9a7 || id == 0x80ac58cd || id == 0x5b5e139f; // ERC-165, ERC-721, ERC-721 Metadata
    }

    // ---------- ERC-721 ----------
    function balanceOf(address owner) external view returns (uint256) {
        if (owner == address(0)) revert BadAddress();
        return _balances[owner];
    }

    function ownerOf(uint256 tokenId) public view returns (address owner) {
        owner = _owners[tokenId];
        if (owner == address(0)) revert NoSuchToken(tokenId);
    }

    function tokenURI(uint256 tokenId) external view returns (string memory) {
        ownerOf(tokenId);
        return string.concat(baseURI, _decimal(tokenId));
    }

    function approve(address to, uint256 tokenId) external {
        address owner = ownerOf(tokenId);
        if (msg.sender != owner && !_operators[owner][msg.sender]) revert NotAllowed();
        _approved[tokenId] = to;
        emit Approval(owner, to, tokenId);
    }

    function getApproved(uint256 tokenId) external view returns (address) {
        ownerOf(tokenId);
        return _approved[tokenId];
    }

    function setApprovalForAll(address operator, bool approved) external {
        _operators[msg.sender][operator] = approved;
        emit ApprovalForAll(msg.sender, operator, approved);
    }

    function isApprovedForAll(address owner, address operator) external view returns (bool) {
        return _operators[owner][operator];
    }

    function transferFrom(address from, address to, uint256 tokenId) public {
        address owner = ownerOf(tokenId);
        if (owner != from) revert NotAllowed();
        if (to == address(0)) revert BadAddress();
        if (msg.sender != owner && _approved[tokenId] != msg.sender && !_operators[owner][msg.sender]) revert NotAllowed();
        delete _approved[tokenId];
        unchecked {
            _balances[from]--;
            _balances[to]++;
        }
        _owners[tokenId] = to;
        emit Transfer(from, to, tokenId);
    }

    function safeTransferFrom(address from, address to, uint256 tokenId) external {
        safeTransferFrom(from, to, tokenId, "");
    }

    function safeTransferFrom(address from, address to, uint256 tokenId, bytes memory data) public {
        transferFrom(from, to, tokenId);
        if (to.code.length > 0) {
            (bool ok, bytes memory ret) = to.call(abi.encodeWithSelector(0x150b7a02, msg.sender, from, tokenId, data));
            if (!ok || ret.length < 32 || abi.decode(ret, (bytes4)) != bytes4(0x150b7a02)) revert NotReceiver();
        }
    }

    // ---------- the keeper ----------
    /// @notice Mints a batch: each id once, to the address the player gave.
    function mint(address[] calldata to, uint256[] calldata tokenIds) external {
        if (msg.sender != keeper) revert NotKeeper();
        for (uint256 i; i < tokenIds.length; i++) {
            if (to[i] == address(0)) revert BadAddress();
            if (_owners[tokenIds[i]] != address(0)) revert AlreadyMinted(tokenIds[i]);
            _owners[tokenIds[i]] = to[i];
            unchecked {
                _balances[to[i]]++;
            }
            emit Transfer(address(0), to[i], tokenIds[i]);
        }
    }

    function setBaseURI(string calldata base) external {
        if (msg.sender != keeper) revert NotKeeper();
        baseURI = base;
    }

    function _decimal(uint256 v) private pure returns (string memory) {
        if (v == 0) return "0";
        uint256 len;
        for (uint256 t = v; t != 0; t /= 10) len++;
        bytes memory out = new bytes(len);
        for (; v != 0; v /= 10) out[--len] = bytes1(uint8(48 + (v % 10)));
        return string(out);
    }
}
