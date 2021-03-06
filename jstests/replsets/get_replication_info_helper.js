// Tests the output of db.getReplicationInfo(), db.printSlaveReplicationInfo(), and the latter's
// alias, db.printSecondaryReplicationInfo().
// @tags: [requires_fcv_47]

(function() {
"use strict";
var name = "getReplicationInfo";
var replSet = new ReplSetTest({name: name, nodes: 3, oplogSize: 50});
var nodes = replSet.nodeList();
replSet.startSet();
replSet.initiate();

var primary = replSet.getPrimary();
for (var i = 0; i < 100; i++) {
    primary.getDB('test').foo.insert({a: i});
}
replSet.awaitReplication();

var replInfo = primary.getDB('admin').getReplicationInfo();
var replInfoString = tojson(replInfo);

assert.eq(50, replInfo.logSizeMB, replInfoString);
assert.lt(0, replInfo.usedMB, replInfoString);
assert.lte(0, replInfo.timeDiff, replInfoString);
assert.lte(0, replInfo.timeDiffHours, replInfoString);
// Just make sure the following fields exist since it would be hard to predict their values
assert(replInfo.tFirst, replInfoString);
assert(replInfo.tLast, replInfoString);
assert(replInfo.now, replInfoString);

// calling this function with and without a primary, should provide sufficient code coverage
// to catch any JS errors
var mongo =
    startParallelShell("db.getSiblingDB('admin').printSlaveReplicationInfo();", primary.port);
mongo();
assert(rawMongoProgramOutput().match("behind the primary"));

// get to a primaryless state
for (i in replSet._slaves) {
    var secondary = replSet._slaves[i];
    secondary.getDB('admin').runCommand({replSetFreeze: 120});
}
assert.commandWorked(primary.getDB('admin').runCommand({replSetStepDown: 120, force: true}));

// printSlaveReplicationInfo is deprecated and aliased to printSecondaryReplicationInfo, but ensure
// it still works for backwards compatibility.
mongo = startParallelShell("db.getSiblingDB('admin').printSlaveReplicationInfo();", primary.port);
mongo();
assert(rawMongoProgramOutput().match("behind the freshest"));

clearRawMongoProgramOutput();
assert.eq(rawMongoProgramOutput().match("behind the freshest"), null);

// Ensure that the new helper, printSecondaryReplicationInfo works the same.
mongo =
    startParallelShell("db.getSiblingDB('admin').printSecondaryReplicationInfo();", primary.port);
mongo();
assert(rawMongoProgramOutput().match("behind the freshest"));

replSet.stopSet();
})();
