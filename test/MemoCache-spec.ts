import {FetchFunc, LockRenewFunc, RedisMemoCache} from '../src/MemoCache'
import * as IORedis from 'ioredis'
import {assert} from 'chai'
import * as sinon from 'sinon'
import * as uuid from 'uuid';


describe("Memo-Cache Tests", function () {

    let allClient: IORedis.Redis;
    let subClient: IORedis.Redis;
    let globalLockTimeout = 5;
    let resId: string, resTimeout: number, resultValue: string, fetchFunc: any = undefined;

    beforeEach(function (done) {
        allClient = new IORedis();
        subClient = new IORedis();
        sinon.restore();
        resId = uuid.v4();
        resTimeout = 10;
        resultValue = uuid.v4();
        fetchFunc = sinon.stub();
        done()
    });

    afterEach(function (done) {
        allClient.disconnect();
        subClient.disconnect();
        done()
    });

    it('creates new instance', async function () {
        await RedisMemoCache.newRedisMemoCache(subClient, allClient, 'testing', globalLockTimeout);
    });

    it('fails to create due to same client instance ', function (done) {
        RedisMemoCache.newRedisMemoCache(subClient, subClient, 'testing', globalLockTimeout).then(() => {
            throw new Error('Should have thrown an exception')
        }).catch(err => {
            done();
        })
    });


    describe('getResource', function () {

        it('should get resource once', async function () {
            const memoCache = await RedisMemoCache.newRedisMemoCache(subClient, allClient, 'testing', globalLockTimeout);

            fetchFunc.returns(Promise.resolve({timeToLive: 4, value: resultValue}));

            const result = await memoCache.getResource(resId, resTimeout, fetchFunc);

            assert.equal(result, resultValue);
            assert.isTrue(fetchFunc.calledOnce);
        });

        it('should get resource twice, from cache', async function () {
            const memoCache = await RedisMemoCache.newRedisMemoCache(subClient, allClient, 'testing', globalLockTimeout);

            fetchFunc.returns(Promise.resolve({timeToLive: 4, value: resultValue}));

            const result1 = await memoCache.getResource(resId, resTimeout, fetchFunc);
            const result2 = await memoCache.getResource(resId, resTimeout, fetchFunc);

            assert.equal(result1, resultValue);
            assert.equal(result2, resultValue);
            assert.isTrue(fetchFunc.calledOnce);
        });

        it('should get resource twice, from subscription', async function () {
            const memoCache = await RedisMemoCache.newRedisMemoCache(subClient, allClient, 'testing', globalLockTimeout);
            const addSubscriptionStub = replaceAddSubscription(memoCache);

            fetchFunc.returns((async () => {
                await sleep(100);
                return {timeToLive: 4, value: resultValue}
            })());

            const result1 = memoCache.getResource(resId, resTimeout, fetchFunc);
            const result2 = memoCache.getResource(resId, resTimeout, fetchFunc);

            assert.equal(await result1, resultValue);
            assert.equal(await result2, resultValue);
            assert.isTrue(fetchFunc.calledOnce);
            assert.isTrue(addSubscriptionStub.calledOnce);
        });

        it('should get resource twice, from cache re-fetch', async function () {
            const memoCache = await RedisMemoCache.newRedisMemoCache(subClient, allClient, 'testing', globalLockTimeout);
            const addSubscriptionStub = replaceAddSubscription(memoCache);

            fetchFunc.returns(Promise.resolve({timeToLive: 4, value: resultValue}));

            const result1 = memoCache.getResource(resId, resTimeout, fetchFunc);
            const result2 = memoCache.getResource(resId, resTimeout, fetchFunc);

            assert.equal(await result1, resultValue);
            assert.equal(await result2, resultValue);
            assert.isTrue(fetchFunc.calledOnce);
            assert.isTrue(addSubscriptionStub.calledOnce);
        });

        it('should timeout waiting for resource', async function () {
            const memoCache = await RedisMemoCache.newRedisMemoCache(subClient, allClient, 'testing', globalLockTimeout);
            const addSubscriptionStub = replaceAddSubscription(memoCache);

            fetchFunc.returns((async () => {
                await sleep(210);
                return {timeToLive: 4, value: resultValue}
            })());

            let threwException = false;
            const result1 = memoCache.getResource(resId, 0.2, fetchFunc);
            const result2 = memoCache.getResource(resId, 0.2, fetchFunc).catch(e => threwException = true);

            assert.equal(await result1, resultValue);

            await result2;

            assert.isTrue(threwException);
            assert.isTrue(fetchFunc.calledOnce);
            assert.isTrue(addSubscriptionStub.calledOnce);
        });

        it('should throw an error by fetch func', async function () {
            const memoCache = await RedisMemoCache.newRedisMemoCache(subClient, allClient, 'testing', globalLockTimeout);

            const error = new Error('Mock Error');
            fetchFunc.rejects(error);

            let errorsThrown = 0;
            try {
                await memoCache.getResource(resId, resTimeout, fetchFunc);
            } catch (e) {
                if (e === error)
                    errorsThrown++;
            }
            try {
                await memoCache.getResource(resId, resTimeout, fetchFunc);
            } catch (e) {
                if (e === error) errorsThrown++
            }

            assert.isTrue(fetchFunc.calledTwice);
            assert.equal(errorsThrown, 2);

        });

        it('should throw an error at the pipeline', function (done) {
            const memoCache = RedisMemoCache.newRedisMemoCache(subClient, allClient, 'testing', globalLockTimeout)
                .then(cache => {
                    fetchFunc.returns(Promise.resolve({timeToLive: "abc", value: resultValue}));

                    cache.getResource(resId, resTimeout, fetchFunc).then(() => {
                        throw new Error('Promise should not resolve');
                    }).catch(e => {
                        assert.isTrue(fetchFunc.calledOnce);
                        assert.isAbove(e.message.indexOf('integer'), -1);
                        done();
                    })
                })
                .catch(e => {
                    throw e;
                });
        });
    });

    describe('getResourceRenewable', function() {

        it('should get resource once, renewable function', async function () {
            const memoCache = await RedisMemoCache.newRedisMemoCache(subClient, allClient, 'testing', globalLockTimeout);
            const lockRenewFuncGeneratorStub = replaceLockRenewFuncGenerator(memoCache);

            fetchFunc.callsFake(async (renewFunc: LockRenewFunc) => {
                await renewFunc(5);
                return {timeToLive: 4, value: resultValue}
            });

            const result = await memoCache.getResourceRenewable(resId, resTimeout, fetchFunc);

            assert.equal(result, resultValue);
            assert.isTrue(fetchFunc.calledOnce);
            assert.isTrue(lockRenewFuncGeneratorStub.calledOnce);
        });

        it('should get resource once, renewable function fails', async function () {
            const memoCache = await RedisMemoCache.newRedisMemoCache(subClient, allClient, 'testing', 1);
            const lockRenewFuncGeneratorStub = replaceLockRenewFuncGenerator(memoCache);

            fetchFunc.callsFake(async (renewFunc: LockRenewFunc) => {
                await sleep(1010);
                await renewFunc(5);
                return {timeToLive: 4, value: resultValue}
            });

            let errorThrown = false;
            try {
                await memoCache.getResourceRenewable(resId, resTimeout, fetchFunc);
            } catch (e) {
                errorThrown = true;
                assert.equal(e.message, 'Unable to renew the lock');
            }
            assert.isTrue(errorThrown);
            assert.isTrue(fetchFunc.calledOnce);
            assert.isTrue(lockRenewFuncGeneratorStub.calledOnce);
        });
    });

});

// Replaces the addSubscription method with a spy
function replaceAddSubscription(memoCache: any) {
    const addSubscriptionStub = sinon.stub();
    addSubscriptionStub.callsFake((<any>memoCache).__proto__.addSubscription);
    sinon.replace(memoCache, <any>'addSubscription', addSubscriptionStub);
    return addSubscriptionStub;
}

// Replaces the lockRenewFuncGenerator method with a spy
function replaceLockRenewFuncGenerator(memoCache: any) {
    const lockRenewFuncGeneratorStub = sinon.stub();
    lockRenewFuncGeneratorStub.callsFake((<any>memoCache).__proto__.lockRenewFuncGenerator);
    sinon.replace(memoCache, <any>'lockRenewFuncGenerator', lockRenewFuncGeneratorStub);
    return lockRenewFuncGeneratorStub;
}

// Helper method for waiting
const sleep = (milliseconds: number) => {
    return new Promise(resolve => setTimeout(resolve, milliseconds))
};