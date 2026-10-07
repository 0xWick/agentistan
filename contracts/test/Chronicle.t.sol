// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Chronicle} from "../src/Chronicle.sol";

contract ChronicleTest is Test {
    Chronicle c;

    function setUp() public {
        c = new Chronicle();
    }

    function _year(uint32 year, Chronicle.Deed[] memory deeds, Chronicle.Treaty[] memory treaties, Chronicle.Breach[] memory breaches) internal {
        c.seal(Chronicle.Year(1, year, (year + 1) * 12, keccak256("state"), keccak256("record")), new uint16[](0), new string[](0), deeds, treaties, breaches);
    }

    function testDeedsAndTreatiesAreRecorded() public {
        Chronicle.Deed[] memory deeds = new Chronicle.Deed[](1);
        deeds[0] = Chronicle.Deed(7, 3, 1, 5);
        Chronicle.Treaty[] memory treaties = new Chronicle.Treaty[](1);
        treaties[0] = Chronicle.Treaty(42, 1, 3, 9, 6, 66, 4, 9);
        _year(0, deeds, treaties, new Chronicle.Breach[](0));
        (uint16 province, uint16 realm, uint8 how, uint32 month) = c.deedOf(1, 7);
        assertEq(province, 7);
        assertEq(realm, 3);
        assertEq(how, 1);
        assertEq(month, 5);
        assertEq(c.yearsSealed(1), 1);
    }

    function testYearsMustComeInOrder() public {
        vm.expectRevert(abi.encodeWithSelector(Chronicle.YearOutOfOrder.selector, uint32(0), uint32(1)));
        _year(1, new Chronicle.Deed[](0), new Chronicle.Treaty[](0), new Chronicle.Breach[](0));
    }

    function testAnOathBreaksOnceAndOnlyIfSworn() public {
        Chronicle.Treaty[] memory treaties = new Chronicle.Treaty[](1);
        treaties[0] = Chronicle.Treaty(42, 2, 3, 9, 6, 0, 0, 0);
        Chronicle.Breach[] memory breaches = new Chronicle.Breach[](1);
        breaches[0] = Chronicle.Breach(42, 3, 20);
        _year(0, new Chronicle.Deed[](0), treaties, breaches);
        vm.expectRevert(abi.encodeWithSelector(Chronicle.AlreadyBroken.selector, uint32(42)));
        _year(1, new Chronicle.Deed[](0), new Chronicle.Treaty[](0), breaches);
        breaches[0] = Chronicle.Breach(77, 3, 30);
        vm.expectRevert(abi.encodeWithSelector(Chronicle.UnknownTreaty.selector, uint32(77)));
        _year(1, new Chronicle.Deed[](0), new Chronicle.Treaty[](0), breaches);
        breaches[0] = Chronicle.Breach(42, 5, 30);
    }

    function testOnlyTheKeeperSeals() public {
        vm.prank(address(0xBEEF));
        vm.expectRevert(Chronicle.NotKeeper.selector);
        _year(0, new Chronicle.Deed[](0), new Chronicle.Treaty[](0), new Chronicle.Breach[](0));
    }
}
