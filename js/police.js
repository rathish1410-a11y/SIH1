import { getDisruptions, getUnverifiedDisruptions, verifyDisruption } from './disruptions.js';
import { getVehicles, getAffectedVehicles, updateVehicleStatus } from './vehicles.js';
import { getAlternateRoute } from './routes.js';
import { sendAlert } from './alerts.js';

export function getDispatchBoard() {
  const affected = getAffectedVehicles();
  return affected.map(v => {
    const alt = getAlternateRoute(v.routeId);
    return {
      ...v,
      alternateRoute: alt
    };
  });
}

export function assignAlternateRoute(vehicleId) {
  const vehicle = getVehicles().find(v => v.id === vehicleId);
  if (!vehicle) return null;
  const alt = getAlternateRoute(vehicle.routeId);
  if (!alt) return null;

  updateVehicleStatus(vehicleId, 'rerouted');

  sendAlert({
    title: 'Reroute Instruction',
    message: `Alternate route assigned for ${vehicle.id}. New ETA: ${alt.eta}. Follow the amber-highlighted path on your map.`,
    severity: 'urgent',
    targetRole: 'driver',
    from: 'Police Control'
  });

  return alt;
}

export function contactDriver(vehicleId, method) {
  const vehicle = getVehicles().find(v => v.id === vehicleId);
  if (!vehicle) return;
  sendAlert({
    title: method === 'call' ? 'Call Initiated' : 'Message Sent',
    message: `${method === 'call' ? 'Calling' : 'Messaging'} ${vehicle.driverName} (${vehicle.id}) at ${vehicle.phone}`,
    severity: 'info',
    targetRole: 'police',
    from: 'Police Control'
  });
}

export function getVerificationQueue() {
  return getUnverifiedDisruptions();
}

export function approveDisruption(id) {
  verifyDisruption(id, true);
  sendAlert({
    title: 'Disruption Verified',
    message: `Disruption ${id} has been verified and is now active on the map.`,
    severity: 'success',
    targetRole: 'all',
    from: 'Police Control'
  });
}

export function rejectDisruption(id) {
  verifyDisruption(id, false);
  const dis = getDisruptions().find(d => d.id === id);
  if (dis) dis.status = 'rejected';
  sendAlert({
    title: 'Report Rejected',
    message: `Disruption report ${id} has been rejected after review.`,
    severity: 'advisory',
    targetRole: 'patrol',
    from: 'Police Control'
  });
}

export function escalateDisruption(id) {
  const dis = getDisruptions().find(d => d.id === id);
  if (dis) {
    dis.severity = 'critical';
    dis.verified = true;
  }
  sendAlert({
    title: 'Disruption Escalated',
    message: `Disruption ${id} has been escalated to CRITICAL severity. All nearby units notified.`,
    severity: 'urgent',
    targetRole: 'all',
    from: 'Police Control'
  });
}

export function broadcastAnnouncement(message, targetRole = 'all') {
  sendAlert({
    title: 'Emergency Announcement',
    message,
    severity: 'urgent',
    targetRole,
    from: 'Police Control'
  });
}

export function generateIncidentReport(disruptionId) {
  const dis = getDisruptions().find(d => d.id === disruptionId);
  if (!dis) return null;

  const affectedVehicles = getVehicles().filter(v =>
    dis.affectedRoutes && dis.affectedRoutes.includes(v.routeId)
  );

  return {
    id: dis.id,
    type: dis.type,
    severity: dis.severity,
    location: dis.location,
    description: dis.description,
    status: dis.status,
    reportedBy: dis.reportedBy,
    reportedAt: dis.reportedAt,
    verified: dis.verified,
    affectedVehicles: affectedVehicles.map(v => ({
      id: v.id,
      driver: v.driverName,
      cargo: v.cargo,
      status: v.status
    })),
    generatedAt: new Date().toISOString()
  };
}
