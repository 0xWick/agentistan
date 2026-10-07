// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Agentistan's registry of land and oaths. Once a year of the game, the keeper (the game server) seals that
/// year: a fingerprint of the world and of its public record, every change of hands (a deed), every treaty signed and
/// every treaty broken. Deeds are kept per province, so the chain itself answers "who holds Herat, since when, and
/// how". The game never waits for a seal; anyone can replay the age from its record and check it against these.
/// A king may break his word in the game, but the breach can be written only once, only for a treaty on the record,
/// and nothing can unwrite a year once sealed.
contract Chronicle {
    struct Deed {
        uint16 province;
        uint16 realm;
        uint8 how; // 0 held at the start, 1 conquest, 2 revolt, 3 secession, 4 bribe, 5 inheritance, 6 verdict, 7 commune, 8 treaty
        uint32 month;
    }

    struct Treaty {
        uint32 id;
        uint8 kind; // 1 peace, 2 alliance, 3 marriage, 4 vassal, 5 verdict
        uint16 a;
        uint16 b;
        uint32 signed;
        uint32 until; // 0: open-ended
        uint32 gold; // tribute a month, in the game's coin
        uint16 payer;
    }

    struct Breach {
        uint32 id;
        uint16 by;
        uint32 month;
    }

    address public immutable keeper;
    mapping(uint32 age => uint32) public yearsSealed;
    mapping(uint32 age => mapping(uint16 province => Deed)) public deedOf;
    mapping(uint32 age => mapping(uint32 id => Treaty)) public treatyOf;
    mapping(uint32 age => mapping(uint32 id => Breach)) public breachOf;

    event YearSealed(uint32 indexed age, uint32 indexed year, uint32 month, bytes32 stateHash, bytes32 recordHash, uint16 deeds, uint16 treaties, uint16 breaches);
    event RealmNamed(uint32 indexed age, uint16 indexed realm, string name);
    event DeedRecorded(uint32 indexed age, uint16 indexed province, uint16 indexed realm, uint8 how, uint32 month);
    event TreatySigned(uint32 indexed age, uint32 indexed id, uint8 kind, uint16 a, uint16 b, uint32 until, uint32 gold, uint16 payer);
    event TreatyBroken(uint32 indexed age, uint32 indexed id, uint16 indexed by, uint32 month);

    error NotKeeper();
    error YearOutOfOrder(uint32 expected, uint32 got);
    error Mismatch();
    error UnknownTreaty(uint32 id);
    error AlreadyBroken(uint32 id);
    error NotAParty(uint32 id, uint16 by);

    constructor() {
        keeper = msg.sender;
    }

    struct Year {
        uint32 age;
        uint32 year;
        uint32 month;
        bytes32 stateHash;
        bytes32 recordHash;
    }

    function seal(Year calldata y, uint16[] calldata realms, string[] calldata names, Deed[] calldata deeds, Treaty[] calldata treaties, Breach[] calldata breaches) external {
        if (msg.sender != keeper) revert NotKeeper();
        if (y.year != yearsSealed[y.age]) revert YearOutOfOrder(yearsSealed[y.age], y.year);
        if (realms.length != names.length) revert Mismatch();
        yearsSealed[y.age] = y.year + 1;
        for (uint256 i; i < realms.length; i++) emit RealmNamed(y.age, realms[i], names[i]);
        _deeds(y.age, deeds);
        _treaties(y.age, treaties);
        _breaches(y.age, breaches);
        emit YearSealed(y.age, y.year, y.month, y.stateHash, y.recordHash, uint16(deeds.length), uint16(treaties.length), uint16(breaches.length));
    }

    function _deeds(uint32 age, Deed[] calldata deeds) internal {
        for (uint256 i; i < deeds.length; i++) {
            Deed calldata d = deeds[i];
            deedOf[age][d.province] = d;
            emit DeedRecorded(age, d.province, d.realm, d.how, d.month);
        }
    }

    function _treaties(uint32 age, Treaty[] calldata treaties) internal {
        for (uint256 i; i < treaties.length; i++) {
            Treaty calldata t = treaties[i];
            treatyOf[age][t.id] = t;
            emit TreatySigned(age, t.id, t.kind, t.a, t.b, t.until, t.gold, t.payer);
        }
    }

    function _breaches(uint32 age, Breach[] calldata breaches) internal {
        for (uint256 i; i < breaches.length; i++) {
            Breach calldata b = breaches[i];
            Treaty storage t = treatyOf[age][b.id];
            if (t.kind == 0) revert UnknownTreaty(b.id);
            if (breachOf[age][b.id].month != 0 || breachOf[age][b.id].by != 0) revert AlreadyBroken(b.id);
            if (b.by != t.a && b.by != t.b) revert NotAParty(b.id, b.by);
            breachOf[age][b.id] = b;
            emit TreatyBroken(age, b.id, b.by, b.month);
        }
    }
}
