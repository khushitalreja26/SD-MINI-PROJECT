function generateWeightedSelection(services) {
  const eligible = services.filter(service => {
    const status = String(service.healthStatus || service.status || "").toLowerCase();
    return status === "healthy" || status === "unknown";
  });

  if (!eligible.length) {
    return null;
  }

  const totalWeight = eligible.reduce((sum, service) => sum + (Number(service.trafficWeight) || 0), 0);
  if (totalWeight <= 0) {
    return eligible[0];
  }

  let cursor = 0;
  const roll = Math.random() * totalWeight;

  for (const service of eligible) {
    cursor += Number(service.trafficWeight) || 0;
    if (roll <= cursor) {
      return service;
    }
  }

  return eligible[eligible.length - 1];
}

async function fetchTrafficState(controlPlaneUrl = "http://localhost:5001") {
  const [configRes, weightsRes, healthRes] = await Promise.all([
    fetch(`${controlPlaneUrl}/config`),
    fetch(`${controlPlaneUrl}/traffic-weights`),
    fetch(`${controlPlaneUrl}/health-status`)
  ]);

  if (!configRes.ok || !weightsRes.ok || !healthRes.ok) {
    throw new Error("Unable to read control-plane routing state");
  }

  const configData = await configRes.json();
  const weightsData = await weightsRes.json();
  const healthData = await healthRes.json();

  return (configData.services || []).map(service => ({
    id: service.id,
    cloud: service.cloud,
    serviceURL: service.serviceURL,
    sidecarURL: service.sidecarURL,
    trafficWeight: Number(weightsData[service.id] ?? service.trafficWeight ?? 0),
    healthStatus: healthData[service.id]?.status || "unknown"
  }));
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
