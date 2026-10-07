// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Regalia} from "../src/Regalia.sol";

contract RegaliaTest is Test {
    Regalia r;
    address alice = address(0xA11CE);
    address bob = address(0xB0B);

    function setUp() public {
        r = new Regalia("https://agentistan.umarkhatana.com/nft/");
    }

    function _mintOne(address to, uint256 id) internal {
        address[] memory a = new address[](1);
        uint256[] memory ids = new uint256[](1);
        a[0] = to;
        ids[0] = id;
        r.mint(a, ids);
    }

    function testKeeperMintsAndTheTokenTellsWhereItsStoryIs() public {
        _mintOne(alice, 42);
        assertEq(r.ownerOf(42), alice);
        assertEq(r.balanceOf(alice), 1);
        assertEq(r.tokenURI(42), "https://agentistan.umarkhatana.com/nft/42");
    }

    function testOnlyTheKeeperMints() public {
        vm.prank(bob);
        address[] memory a = new address[](1);
        uint256[] memory ids = new uint256[](1);
        a[0] = bob;
        ids[0] = 1;
        vm.expectRevert(Regalia.NotKeeper.selector);
        r.mint(a, ids);
    }

    function testATokenIsMintedOnce() public {
        _mintOne(alice, 7);
        address[] memory a = new address[](1);
        uint256[] memory ids = new uint256[](1);
        a[0] = bob;
        ids[0] = 7;
        vm.expectRevert(abi.encodeWithSelector(Regalia.AlreadyMinted.selector, 7));
        r.mint(a, ids);
    }

    function testTheOwnerCanGiveItAway() public {
        _mintOne(alice, 3);
        vm.prank(alice);
        r.transferFrom(alice, bob, 3);
        assertEq(r.ownerOf(3), bob);
        assertEq(r.balanceOf(alice), 0);
        vm.prank(alice);
        vm.expectRevert(Regalia.NotAllowed.selector);
        r.transferFrom(bob, alice, 3);
    }

    function testItSpeaksErc721() public view {
        assertTrue(r.supportsInterface(0x80ac58cd));
        assertTrue(r.supportsInterface(0x5b5e139f));
        assertTrue(r.supportsInterface(0x01ffc9a7));
        assertFalse(r.supportsInterface(0xffffffff));
    }
}
