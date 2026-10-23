import { HealthPill } from '../panels';
import { Server, Cloud, HardDrive } from 'lucide-react';

export function SupOverview({
  b2Status,
  formatBytes,
  infraStatus,
  systemStatus,
}) {
  return (
    <>
    {/* Bandeau d'état global — santé de l'app en un coup d'œil */}
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      <HealthPill
        icon={Server}
        label="Backend"
        status={
          !infraStatus
            ? "loading"
            : infraStatus.backend?.ok
              ? "ok"
              : "down"
        }
        detail={infraStatus?.backend?.region}
      />
      <HealthPill
        icon={Cloud}
        label="Frontend"
        status={
          !infraStatus
            ? "loading"
            : infraStatus.netlify?.configured === false
              ? "warn"
              : infraStatus.netlify?.ok
                ? "ok"
                : "down"
        }
        detail={infraStatus?.netlify?.state}
      />
      <HealthPill
        icon={HardDrive}
        label="Base de données"
        status={
          !systemStatus
            ? "loading"
            : systemStatus.mongo_connected
              ? "ok"
              : "down"
        }
        detail={
          systemStatus
            ? formatBytes(systemStatus.db_data_size_bytes)
            : undefined
        }
      />
      <HealthPill
        icon={Cloud}
        label="Stockage B2"
        status={
          !b2Status
            ? "loading"
            : b2Status.primary?.configured ||
                b2Status.backup?.configured
              ? "ok"
              : "warn"
        }
        detail={
          b2Status?.active_account === "primary"
            ? "Compte principal actif"
            : b2Status?.active_account === "backup"
              ? "Compte de secours actif"
              : undefined
        }
      />
    </div>
    </>
  );
}
