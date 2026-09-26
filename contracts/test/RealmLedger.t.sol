// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {RealmLedger} from "../src/RealmLedger.sol";

contract MockFeed {
    int256 public answer = 2500e8;
    uint256 public updatedAt = 1_700_000_000;

    function set(int256 a) external {
        answer = a;
    }

    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80) {
        return (1, answer, updatedAt, updatedAt, 1);
    }
}

contract RealmLedgerTest is Test {
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

    MockFeed feed;
    RealmLedger ledger;
    bytes32 constant HASH = keccak256("battle");

    function setUp() public {
        feed = new MockFeed();
        ledger = new RealmLedger(address(feed));
    }

    function test_CaptureStampsOraclePrice() public {
        vm.expectEmit(true, true, false, true);
        emit StrongholdCaptured(1, 3, 3, 1, 0, 2500e8, 1_700_000_000, HASH);
        ledger.recordCapture(1, 3, 3, 1, HASH);
        assertEq(ledger.ownerOf(1, 3), 1);

        vm.expectEmit(true, true, false, true);
        emit StrongholdCaptured(1, 8, 3, 2, 1, 2500e8, 1_700_000_000, HASH);
        ledger.recordCapture(1, 8, 3, 2, HASH);
        assertEq(ledger.ownerOf(1, 3), 2);
    }

    function test_OnlyOperatorCanWrite() public {
        vm.startPrank(address(0xBEEF));
        vm.expectRevert(RealmLedger.NotOperator.selector);
        ledger.recordCapture(1, 3, 3, 1, HASH);
        vm.expectRevert(RealmLedger.NotOperator.selector);
        ledger.recordSeasonResult(1, 1, 12, HASH);
        vm.stopPrank();
    }

    function test_RejectsNonPositivePrice() public {
        feed.set(0);
        vm.expectRevert(RealmLedger.BadPrice.selector);
        ledger.recordCapture(1, 3, 3, 1, HASH);
    }

    function test_SeasonResultEvent() public {
        vm.expectEmit(true, false, false, true);
        emit SeasonEnded(1, 2, 40, HASH);
        ledger.recordSeasonResult(1, 2, 40, HASH);
    }

    /// Fork test against the real Chainlink ETH/USD feed on Base Sepolia (set FORK_RPC_URL to run).
    function test_Fork_ReadsRealChainlinkFeed() public {
        string memory rpc = vm.envOr("FORK_RPC_URL", string(""));
        if (bytes(rpc).length == 0) return;
        vm.createSelectFork(rpc);
        RealmLedger real = new RealmLedger(0x4aDC67696bA383F43DD60A9e78F2C97Fbbfc7cb1);
        vm.recordLogs();
        real.recordCapture(1, 1, 3, 1, HASH);
        (, int256 answer,, uint256 updatedAt,) = real.priceFeed().latestRoundData();
        assertGt(answer, 0);
        assertGt(updatedAt, block.timestamp - 2 days);
        assertEq(real.ownerOf(1, 3), 1);
    }
}
