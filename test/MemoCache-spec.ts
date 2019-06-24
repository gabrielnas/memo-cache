/*
const sleep = (milliseconds: number) => {
    return new Promise(resolve => setTimeout(resolve, milliseconds))
}

(async () => {
    const memoLockList = [];

    for (let i = 0; i < 10; i++) {
        memoLockList.push(await RedisMemoLock.newRedisMemoLock(redis, pub, 'gdsp', 3));
    }
    ;

    let iteration = 0;
    const reFetchFunc: RenewableFetchFunc = async (func: LockRenewFunc) => {

        await sleep(2000);
        await func(10)
        await sleep(7000);
        await func(1)
        return {timeToLive: 4, value: 'mockedVal ' + iteration}
    };


    const fetchFunc: FetchFunc = async () => {
        await sleep(3000);
        //     if (iteration++ % 3 == 0) throw new Error('Oooops! !' + iteration);
        return {timeToLive: 4, value: JSON.stringify('mockedVal ' + iteration)}
    };

    try {

        redis.on('reconnecting', () => {
            console.log('Connection to Redis lost, auto-reconnecting...');
        });
        redis.on('error', (err) => {
            console.log('Redis error:' + err);
        });

        const results = [];
        let totalRequests = Array(100).fill(0);
        for (let i = 0; i < 2000; i++) {
            const rand = Math.floor(Math.random() * 10);

            const randProd = Math.floor(Math.random() * 3);
            let redIds = ['AA-1', 'AA-2', 'AA-3']
            try {
                const data =  memoLockList[rand].getResource(redIds[0], 50, fetchFunc);
                results.push(data)
            } catch (ex) {
                console.log('Error before await! ' + ex)
            }
            totalRequests[iteration < 0 ? 0 : iteration] = totalRequests[iteration < 0 ? 0 : iteration] + 1;

            if (i % 10 == 0) {
                //  await data
                //   console.log('Data1: ' + await data)
            }


        }
        let totalResults = Array(100).fill(0);
        for (var r of results) {
            try {
                let val = <any>await r;
                console.log(val)
                val = JSON.parse(val)
                console.log(<any>val)
                if (val) {
                    let split = val.split(' ');
                    let index = parseInt(split[1]);
                    totalResults[index] = totalResults[index] + 1;
                } else {
                    console.log('NULL RESULT!!!!')
                }
            } catch (err) {
                console.log('Error getting resource! ' + err)
            }
        }

        console.log('iteration: ' + iteration)
        //  console.log('fetchFUnc: ' + JSON.stringify(await fetchFunc()))
        console.log(JSON.stringify(totalRequests))
        console.log(JSON.stringify(totalResults))

        console.log('Total requests: ' + totalRequests.reduce((a, b) => a + b))
        console.log('Total results: ' + totalResults.reduce((a, b) => a + b))
        redis.punsubscribe()
        redis.disconnect();

        pub.disconnect();
    } catch (e) {
        console.log(e)
    }


})();*/
