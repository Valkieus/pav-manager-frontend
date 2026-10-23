import { TabsContent } from '../../components/ui/tabs';
import { Activity, Loader2, RefreshCw, Server, HardDrive, Cloud, Database, Wrench } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../components/ui/dialog';
import { ServerLoadCard, CloudinaryAccountsCard } from '../../components/SupervisionExtras';
import { SupTools } from './supervision/SupTools';
import { SupStorage } from './supervision/SupStorage';
import { SupDatabase } from './supervision/SupDatabase';
import { SupBackup } from './supervision/SupBackup';
import { SupCloudinaryMigration } from './supervision/SupCloudinaryMigration';
import { SupB2Return } from './supervision/SupB2Return';
import { SupMaintenance } from './supervision/SupMaintenance';
import { SupDedupe } from './supervision/SupDedupe';
import { SupRedundancy } from './supervision/SupRedundancy';
import { SupInfra } from './supervision/SupInfra';
import { SupOverview } from './supervision/SupOverview';

export function SupervisionTab({
  COLLECTIONS_COLLAPSED_COUNT,
  allowlistAddUserId,
  allowlistBusy,
  b2Backfilling,
  b2LimitInputs,
  b2LimitsSaving,
  b2MirrorToggling,
  b2Status,
  b2StatusLoading,
  b2ToggleDialogOpen,
  b2Toggling,
  canPurgeAllLogs,
  cleanupBusy,
  cloudinaryCfg,
  collectionsExpanded,
  collectionsSortBy,
  dataBacking,
  dataBackup,
  entityError,
  entityExporting,
  entityLoading,
  entitySelected,
  entitySnapshot,
  exportCollection,
  exportFormat,
  exporting,
  fetchB2Status,
  fetchEntitySnapshot,
  fetchInfraStatus,
  fetchSystemStatus,
  fillLabel,
  formatBytes,
  formatUptime,
  handleAddAllowlistUser,
  handleB2Backfill,
  handleB2MirrorToggle,
  handleB2Toggle,
  handleCleanupLogs,
  handleCleanupNotifications,
  handleClearBrowserCache,
  handleConfirmOrphanedCleanup,
  handleDataBackupNow,
  handleExportData,
  handleExportEntityXlsx,
  handleNetlifyRestore,
  handlePlanningFillOctobre,
  handlePlanningRepair,
  handlePreviewOrphanedFiles,
  handlePurgeAllLogsNow,
  handlePurgeAllNotificationsNow,
  handleR2BackupCloudinary,
  handleRemoveAllowlistUser,
  handleRenderRedeploy,
  handleSaveB2Limit,
  handleSaveQuota,
  handleSnapDownload,
  handleSnapRestore,
  handleStartLedMigration,
  infraStatus,
  infraStatusLoading,
  isOwnerAccount,
  isSuperAdmin,
  ledMigrating,
  ledMigration,
  loadSnapDates,
  logPurgeAllowlist,
  netlifyDeploys,
  netlifyDeploysLoading,
  netlifyDeploysOpen,
  netlifyRestoringId,
  orphanPreview,
  patchSnap,
  purgeAllBusy,
  purgeAllDialogOpen,
  purgeAllNotifBusy,
  purgeAllNotifDialogOpen,
  quotaInput,
  quotaSaving,
  r2Backing,
  r2Status,
  renderDeploys,
  renderDeploysLoading,
  renderDeploysOpen,
  renderRedeployDialogOpen,
  renderRedeploying,
  restartSupervisionPolling,
  setAllowlistAddUserId,
  setB2LimitInputs,
  setB2ToggleDialogOpen,
  setCollectionsExpanded,
  setCollectionsSortBy,
  setEntitySelected,
  setExportCollection,
  setExportFormat,
  setOrphanPreview,
  setPurgeAllDialogOpen,
  setPurgeAllNotifDialogOpen,
  setQuotaInput,
  setRenderRedeployDialogOpen,
  setRestartDialogOpen,
  setSupSection,
  snapSel,
  supSection,
  systemStatus,
  systemStatusLoading,
  systemStatusUpdatedAt,
  toggleNetlifyDeploys,
  toggleRenderDeploys,
  users,
}) {
  return (
    <TabsContent value="supervision" className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Activity className="w-4.5 h-4.5 text-primary" />
          </div>
          <div>
            <p className="font-semibold text-sm leading-tight">
              Vue d'ensemble
            </p>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <span
                className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"
                aria-hidden="true"
              />
              Live — Mongo 20s / Stockage B2 45s / Render+Netlify 60s
              {systemStatusUpdatedAt
                ? ` — actualisé à ${new Date(systemStatusUpdatedAt).toLocaleTimeString("fr-FR")}`
                : ""}
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            fetchSystemStatus();
            fetchInfraStatus();
            fetchB2Status();
            restartSupervisionPolling();
          }}
          disabled={
            systemStatusLoading || infraStatusLoading || b2StatusLoading
          }
        >
          {systemStatusLoading ||
          infraStatusLoading ||
          b2StatusLoading ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4 mr-2" />
          )}
          Actualiser
        </Button>
      </div>

      {/* Sous-navigation de la Supervision : une catégorie à la fois, plus de page interminable */}
      <div className="flex gap-1.5 overflow-x-auto rounded-xl border bg-card p-1.5" role="tablist" aria-label="Catégories de la supervision">
        {[
          ["overview", "Vue d'ensemble", Activity],
          ["infra", "Infrastructure", Server],
          ["stockage", "Stockage", HardDrive],
          ["cloudinary", "Cloudinary (LED)", Cloud],
          ["backup", "Sauvegardes", Database],
          ["db", "Base de données", Database],
          ["tools", "Outils", Wrench],
        ].map(([key, label, Icon]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={supSection === key}
            onClick={() => setSupSection(key)}
            className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
              supSection === key ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:bg-muted"
            }`}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {supSection === "overview" && (
      <SupOverview
            b2Status={b2Status}
            formatBytes={formatBytes}
            infraStatus={infraStatus}
            systemStatus={systemStatus}
          />
      )}

      {supSection === "infra" && (
      <SupInfra
            formatUptime={formatUptime}
            handleNetlifyRestore={handleNetlifyRestore}
            handleRenderRedeploy={handleRenderRedeploy}
            infraStatus={infraStatus}
            infraStatusLoading={infraStatusLoading}
            isSuperAdmin={isSuperAdmin}
            netlifyDeploys={netlifyDeploys}
            netlifyDeploysLoading={netlifyDeploysLoading}
            netlifyDeploysOpen={netlifyDeploysOpen}
            netlifyRestoringId={netlifyRestoringId}
            renderDeploys={renderDeploys}
            renderDeploysLoading={renderDeploysLoading}
            renderDeploysOpen={renderDeploysOpen}
            renderRedeployDialogOpen={renderRedeployDialogOpen}
            renderRedeploying={renderRedeploying}
            setRenderRedeployDialogOpen={setRenderRedeployDialogOpen}
            toggleNetlifyDeploys={toggleNetlifyDeploys}
            toggleRenderDeploys={toggleRenderDeploys}
          />
      )}

      {supSection === "stockage" && (
      <SupRedundancy
            b2Backfilling={b2Backfilling}
            b2LimitInputs={b2LimitInputs}
            b2LimitsSaving={b2LimitsSaving}
            b2MirrorToggling={b2MirrorToggling}
            b2Status={b2Status}
            b2StatusLoading={b2StatusLoading}
            formatBytes={formatBytes}
            handleB2Backfill={handleB2Backfill}
            handleB2MirrorToggle={handleB2MirrorToggle}
            handleSaveB2Limit={handleSaveB2Limit}
            isSuperAdmin={isSuperAdmin}
            setB2LimitInputs={setB2LimitInputs}
            setB2ToggleDialogOpen={setB2ToggleDialogOpen}
          />
      )}

      {supSection === "overview" && (
      <>
      <ServerLoadCard />
      </>
      )}
      {supSection === "cloudinary" && (
      <>
      <CloudinaryAccountsCard canEdit={isSuperAdmin()} />
      </>
      )}

      {supSection === "cloudinary" && (
<SupCloudinaryMigration
            cloudinaryCfg={cloudinaryCfg}
            handleStartLedMigration={handleStartLedMigration}
            isSuperAdmin={isSuperAdmin}
            ledMigrating={ledMigrating}
            ledMigration={ledMigration}
          />
      )}

      {supSection === "cloudinary" && <SupB2Return isSuperAdmin={isSuperAdmin} />}

      {(supSection === "cloudinary" || supSection === "backup") && <SupDedupe isSuperAdmin={isSuperAdmin} />}
      {(supSection === "cloudinary" || supSection === "backup" || supSection === "stockage") && <SupMaintenance isSuperAdmin={isSuperAdmin} />}

      {supSection === "backup" && (
      <SupBackup
            dataBacking={dataBacking}
            dataBackup={dataBackup}
            fillLabel={fillLabel}
            formatBytes={formatBytes}
            handleDataBackupNow={handleDataBackupNow}
            handlePlanningFillOctobre={handlePlanningFillOctobre}
            handlePlanningRepair={handlePlanningRepair}
            handleR2BackupCloudinary={handleR2BackupCloudinary}
            handleSnapDownload={handleSnapDownload}
            handleSnapRestore={handleSnapRestore}
            isSuperAdmin={isSuperAdmin}
            loadSnapDates={loadSnapDates}
            patchSnap={patchSnap}
            r2Backing={r2Backing}
            r2Status={r2Status}
            snapSel={snapSel}
          />
      )}

      {/* Confirmation bascule B2 */}
      <Dialog
        open={b2ToggleDialogOpen}
        onOpenChange={setB2ToggleDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Basculer le compte de stockage actif ?
            </DialogTitle>
            <DialogDescription>
              Les fichiers restent présents sur les deux comptes
              (mirroring). Cette action change seulement lequel est
              utilisé en priorité pour lire les fichiers — sans coupure de
              service, réversible à tout moment.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setB2ToggleDialogOpen(false)}
              disabled={b2Toggling}
            >
              Annuler
            </Button>
            <Button onClick={handleB2Toggle} disabled={b2Toggling}>
              {b2Toggling && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              Basculer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {["stockage", "db", "tools"].includes(supSection) && (systemStatusLoading && !systemStatus ? (
        <div className="p-8 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
        </div>
      ) : !systemStatus ? (
        <div className="p-8 text-center text-muted-foreground">
          Aucune donnée pour le moment
        </div>
      ) : (
        <>
      {supSection === "db" && (
      <SupDatabase
            COLLECTIONS_COLLAPSED_COUNT={COLLECTIONS_COLLAPSED_COUNT}
            collectionsExpanded={collectionsExpanded}
            collectionsSortBy={collectionsSortBy}
            formatBytes={formatBytes}
            formatUptime={formatUptime}
            setCollectionsExpanded={setCollectionsExpanded}
            setCollectionsSortBy={setCollectionsSortBy}
            systemStatus={systemStatus}
          />
      )}

      {supSection === "stockage" && (
      <SupStorage
            formatBytes={formatBytes}
            handleSaveQuota={handleSaveQuota}
            isSuperAdmin={isSuperAdmin}
            quotaInput={quotaInput}
            quotaSaving={quotaSaving}
            setQuotaInput={setQuotaInput}
            systemStatus={systemStatus}
          />
      )}

      {supSection === "tools" && (
      <SupTools
            allowlistAddUserId={allowlistAddUserId}
            allowlistBusy={allowlistBusy}
            canPurgeAllLogs={canPurgeAllLogs}
            cleanupBusy={cleanupBusy}
            entityError={entityError}
            entityExporting={entityExporting}
            entityLoading={entityLoading}
            entitySelected={entitySelected}
            entitySnapshot={entitySnapshot}
            exportCollection={exportCollection}
            exportFormat={exportFormat}
            exporting={exporting}
            fetchEntitySnapshot={fetchEntitySnapshot}
            formatBytes={formatBytes}
            handleAddAllowlistUser={handleAddAllowlistUser}
            handleCleanupLogs={handleCleanupLogs}
            handleCleanupNotifications={handleCleanupNotifications}
            handleClearBrowserCache={handleClearBrowserCache}
            handleConfirmOrphanedCleanup={handleConfirmOrphanedCleanup}
            handleExportData={handleExportData}
            handleExportEntityXlsx={handleExportEntityXlsx}
            handlePreviewOrphanedFiles={handlePreviewOrphanedFiles}
            handlePurgeAllLogsNow={handlePurgeAllLogsNow}
            handlePurgeAllNotificationsNow={handlePurgeAllNotificationsNow}
            handleRemoveAllowlistUser={handleRemoveAllowlistUser}
            isOwnerAccount={isOwnerAccount}
            isSuperAdmin={isSuperAdmin}
            logPurgeAllowlist={logPurgeAllowlist}
            orphanPreview={orphanPreview}
            purgeAllBusy={purgeAllBusy}
            purgeAllDialogOpen={purgeAllDialogOpen}
            purgeAllNotifBusy={purgeAllNotifBusy}
            purgeAllNotifDialogOpen={purgeAllNotifDialogOpen}
            setAllowlistAddUserId={setAllowlistAddUserId}
            setEntitySelected={setEntitySelected}
            setExportCollection={setExportCollection}
            setExportFormat={setExportFormat}
            setOrphanPreview={setOrphanPreview}
            setPurgeAllDialogOpen={setPurgeAllDialogOpen}
            setPurgeAllNotifDialogOpen={setPurgeAllNotifDialogOpen}
            setRestartDialogOpen={setRestartDialogOpen}
            systemStatus={systemStatus}
            users={users}
          />
      )}
        </>
      ))}
    </TabsContent>
  );
}
