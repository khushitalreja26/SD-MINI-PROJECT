function generateWeightedSelection(services) {
  const alive = services.filter(service => {
    const status = String(service.healthStatus || service.status || "").toLowerCase();
    return status === "healthy" || status === "unknown";
  });

  if (!alive.length) {
    return null;
  }

  const totalWeight = alive.reduce((sum, service) => sum + (Number(service.trafficWeight) || 0), 0);

  if (totalWeight <= 0) {
    return alive[0];
  }

  const roll = Math.random() * totalWeight;
  let cursor = 0;

  for (const service of alive) {
    const weight = Number(service.trafficWeight) || 0;
    cursor += weight;

    if (roll <= cursor) {
      return service;
    }
  }

  return alive[alive.length - 1];
}

async function fetchTrafficState(controlPlaneUrl = "http://localhost:5001") {
  const [configRes, weightRes, healthRes] = await Promise.all([
    fetch(`${controlPlaneUrl}/config`),
    fetch(`${controlPlaneUrl}/traffic-weights`),
    fetch(`${controlPlaneUrl}/health-status`)
  ]);

  if (!configRes.ok || !weightRes.ok || !healthRes.ok) {
    throw new Error("Unable to read control-plane routing state");
  }

  const configData = await configRes.json();
  const weightsData = await weightRes.json();
  const healthData = await healthRes.json();

  const services = (configData.services || []).map(service => {
    const id = service.id;
    const trafficWeight = Number(weightsData[id] ?? service.trafficWeight ?? 0);
    const healthInfo = healthData[id] || {};

    return {
      id,
      cloud: service.cloud,
      serviceURL: service.serviceURL,
      sidecarURL: service.sidecarURL,
      trafficWeight,
      healthStatus: healthInfo.status || "unknown"
    };
  });

  return services;
}

async function chooseWeightedTarget(controlPlaneUrl = "http://localhost:5001") {
  const services = await fetchTrafficState(controlPlaneUrl);
  const target = generateWeightedSelection(services);

  if (!target) {
    return null;
  }

  return {
    selected: target,
    candidates: services
  };
}

module.exports = {
  generateWeightedSelection,
  fetchTrafficState,
  chooseWeightedTarget
};
