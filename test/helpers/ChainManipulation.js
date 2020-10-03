const revertToSnapshot = (snapshot_id) => {
  return new Promise((resolve, reject) => {
    web3.currentProvider.send({jsonrpc: '2.0', method: 'evm_revert', params: [snapshot_id], id: new Date().getTime()},
                              (err, result) => {
                                if (err) { return reject(err); }
                                return resolve(result);
                              });
    });
};

const getSnapshot = () => {
  return new Promise((resolve, reject) => {
    web3.currentProvider.send({jsonrpc: '2.0', method: 'evm_snapshot', id: new Date().getTime()},
                              (err, result) => {
                                 if (err) { return reject(err); }
                                 return resolve(result);
                              })
    });
};

const advanceTime = (time) => {
  return new Promise((resolve, reject) => {
    web3.currentProvider.send({jsonrpc: '2.0', method: 'evm_increaseTime', params: [time], id: new Date().getTime()},
                              (err, result) => {
                                 if (err) { return reject(err); }
                                 return resolve(result);
                              });
    });
};

const advanceBlock = () => {
  return new Promise((resolve, reject) => {
    web3.currentProvider.send({jsonrpc: '2.0', method: 'evm_mine', id: new Date().getTime()},
                              (err, result) => {
                                if (err) { return reject(err); }
                                return resolve(result);
                              });
    });
};


const setBlockchainTime = async (from_snapshot, time) =>  {
  time = Math.ceil(time);
  await revertToSnapshot(from_snapshot);
  await getSnapshot();
  let bn = await web3.eth.getBlockNumber();
  let bl = await web3.eth.getBlock(bn);
  let tm = bl.timestamp;
  await advanceTime(time-tm);
  await advanceBlock();
}

module.exports = Object({
    revertToSnapshot: revertToSnapshot,
    getSnapshot: getSnapshot,
    advanceTime: advanceTime,
    advanceBlock: advanceBlock,
    setBlockchainTime: setBlockchainTime
});


