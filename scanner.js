const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const dgram = require('dgram');
const ByteBuffer = require('bytebuffer');
const yargs = require('yargs');
const dns = require('dns').promises;
const { consola } = require('consola');
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
			// console.log('pong!'); dev
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

async function port_sort(list) {
	list.sort((a, b) => a - b);
	const result = list.join(',');
	return result;
}

async function main() {
	const ip = await lookup();
	// console.log(args); dev
	const start = args.s;
	const end = args.e;
	// console.log(`IP: ${ip}, ${start} - ${end}`);
	consola.start(`Scanning ${ip}... (Range: ${start}-${end})`);
	if (start > end) {
		consola.fail('Failed!');
		consola.error(`Invalid Param! Start: ${start}, End: ${end}`);
		consola.log('Goodbye');
		process.exit(1);
	}
	for (let i = start; i <= end; i++) {
		ports.push(i);
		// console.log(`Target: ${i}`); dev
		send(ip, i);
	}
	await wait_complete();
	consola.success('Done!');
	if (found.length !== 0) {
		const result = await port_sort(found);
		consola.box(`Found! ${ip} has running server at ${result}!`);
	} else {
		consola.box(`Uhh, ${ip} has not running any server`);
	}
	process.exit(0);
}

main();
