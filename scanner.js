const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const dgram = require('dgram');
const ByteBuffer = require('bytebuffer');
const yargs = require('yargs');
const dns = require('dns').promises;
const args = yargs
	.command('* [options] <destination>', 'Raknet Scaner', (yargs) => {
		return yargs
			.positional('destination', {
				describe: 'Destination IP',
			})
			.option('s', {
				describe: 'ポートスキャンの開始地点',
				default: 19100,
				type: 'number',
			})
			.option('e', {
				describe: 'ポートスキャンの終了地点',
				default: 19200,
				type: 'number',
			});
	})
	.parseSync();

let found = [];
let ports = [];

async function lookup() {
	try {
		const targetIp = (await dns.lookup(args.destination)).address;
		return targetIp;
	} catch {
		console.log(`${args.destination}: Name or service not known`);
		process.exit();
	}
}

async function list_rm(x) {
	const index = ports.indexOf(x);
	if (index !== -1) {
		ports.splice(index, 1);
		return true;
	} else {
		return false;
	}
}

async function send(ip, port) {
	const socket = dgram.createSocket('udp4');
	const bb = new ByteBuffer();
	bb.buffer[0] = 0x01;
	bb.offset = 1;
	const ping = bb
		.writeLong(1)
		.append('00ffff00fefefefefdfdfdfd12345678', 'hex')
		.writeLong(0)
		.flip()
		.compact();

	const messagePromise = new Promise((resolve, reject) => {
		socket.send(ping.buffer, 0, ping.buffer.length, port, ip, (err) => {
			if (err) {
				reject(err);
			}
		});

		socket.on('message', () => {
			console.log('pong!');
			found.push(port);
			list_rm(port);
			resolve(true);
		});

		setTimeout(() => {
			list_rm(port);
			resolve(false);
		}, 1000); // x秒待機
	});

	const result = await messagePromise;
	socket.close();
	return result;
}

async function wait_complete() {
	while (ports.length > 0) {
		// console.log('Waiting... len:' + ports.length);
		// console.log(ports);
		await delay(500);
	}
	return;
}

async function main() {
	const ip = await lookup();
	// console.log(args); dev
	const start = args.s;
	const end = args.e;
	console.log(`IP: ${ip}, ${start} - ${end}`);
	if (start > end) {
		console.error(`StartとEndの値が不正です! Start: ${start}, End: ${end}`);
		console.log('終了します...');
		process.exit(1);
	}
	for (let i = start; i <= end; i++) {
		ports.push(i);
		console.log(`Target: ${i}`);
		send(ip, i);
	}
	console.log('Waiting...');
	await wait_complete();
	console.log('Done!');
	console.log('Result');
	console.log(found);
	process.exit(0);
}

main();
