import json
from sha3 import keccak_256
f = open("../build/contracts/OrionPoolV2Pair.json", "r+")
x = f.read()
print(keccak_256(bytearray.fromhex(json.loads(x)["bytecode"][2:])).hexdigest())