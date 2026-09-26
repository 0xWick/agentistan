// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface AggregatorV3Interface {
    function latestRoundData()
        external
        view
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
}

/// @notice Public receipt book for "Nobody's Playing". Every capture is stamped with the live
/// Chainlink ETH/USD price read by this contract itself. Kingdoms: 1 = Emberreach (red), 2 = Frostmere (blue).
contract RealmLedger {
    AggregatorV3Interface public immutable priceFeed;
    address public immutable operator;
    mapping(uint32 season => mapping(uint8 strongholdId => uint8 kingdom)) public ownerOf;

    event StrongholdCaptured(
        uint32 indexed season,
        uint32 turn,
        uint8 indexed strongholdId,
        uint8 kingdom,
        uint8 previousOwner,
        int256 ethUsd,
        uint256 priceUpdatedAt,
        bytes32 battleHash
    );
    event SeasonEnded(uint32 indexed season, uint8 winner, uint16 rounds, bytes32 finalStateHash);

    error NotOperator();
    error BadPrice();

    constructor(address feed) {
        priceFeed = AggregatorV3Interface(feed);
        operator = msg.sender;
    }

    modifier onlyOperator() {
        if (msg.sender != operator) revert NotOperator();
        _;
    }

    function recordCapture(uint32 season, uint32 turn, uint8 strongholdId, uint8 kingdom, bytes32 battleHash)
        external
        onlyOperator
    {
        (, int256 answer,, uint256 updatedAt,) = priceFeed.latestRoundData();
        if (answer <= 0) revert BadPrice();
        uint8 previous = ownerOf[season][strongholdId];
        ownerOf[season][strongholdId] = kingdom;
        emit StrongholdCaptured(season, turn, strongholdId, kingdom, previous, answer, updatedAt, battleHash);
    }

    function recordSeasonResult(uint32 season, uint8 winner, uint16 rounds, bytes32 finalStateHash) external onlyOperator {
        emit SeasonEnded(season, winner, rounds, finalStateHash);
    }
}
