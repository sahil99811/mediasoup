const getLeastLoadedWorker=() =>{
  return workers.reduce((leastLoaded, worker) => {
    return worker.routers.length < leastLoaded.routers.length
      ? worker
      : leastLoaded;
  }, workers[0]);
}

