import React from 'react';
import { SpecimenRecord } from '../types/specimen';
import { ThemeSwitcher } from './ThemeSwitcher';

interface CoverLandingViewProps {
  onOpenDetail: () => void;
  onOpenMap: () => void;
  onOpenCatalog: () => void;
  onOpenStatistics?: () => void;
  onOpenNewSpecimen: () => void;
  onOpenSyncBackup: () => void;
  onOpenDeviceProfile?: () => void;
  deviceId?: string;
  observerName?: string;
  specimensCount: number;
  totalSightingsCount?: number;
  totalIndividualsCount?: number;
  currentSpecimen: SpecimenRecord;
  cloudSyncStatus?: 'connected' | 'syncing' | 'offline';
  lastCloudSyncTime?: string;
}

export const CoverLandingView: React.FC<CoverLandingViewProps> = ({
  onOpenDetail,
  onOpenMap,
  onOpenCatalog,
  onOpenStatistics,
  onOpenNewSpecimen,
  onOpenSyncBackup,
  onOpenDeviceProfile,
  deviceId,
  observerName,
  specimensCount,
  totalSightingsCount = 0,
  totalIndividualsCount = 0,
  currentSpecimen,
  cloudSyncStatus = 'connected',
  lastCloudSyncTime,
}) => {
  // Fotografía emblema PERMANENTE de la portada: Rana de las Nacientes (Isthmohyla nacientes)
  // Nunca cambia, sin importar qué espécimen se seleccione en el catálogo o qué dispositivo se use
  const PERMANENT_COVER_IMAGE = '/isthmohyla_nacientes.jpg';

  return (
    <div className="relative min-h-[calc(100vh-64px)] w-full flex flex-col justify-between overflow-hidden bg-[#00170f] text-white select-none">
      {/* Background High-Res Nature Hero Image - Rana de las Nacientes Emblem (PERMANENTE E INMUTABLE) */}
      <div
        className="absolute inset-0 bg-cover bg-center sm:bg-[center_top_20%] bg-no-repeat transition-all duration-700"
        style={{ backgroundImage: `url('${PERMANENT_COVER_IMAGE}')` }}
      >
        {/* Balanced contrast overlays preserving vivid frog details, bright greens and amber eyes */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#00170f] via-[#001f15]/50 to-[#00170f]/60" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#00170f]/75 via-transparent to-[#00170f]/65" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(0,23,15,0.7)_90%)]" />
      </div>

      {/* Top Header / Heraldic Bar */}
      <header className="relative z-10 px-5 pt-5 pb-2 max-w-4xl mx-auto w-full flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-[#6cf8bb] shadow-lg">
            <span className="material-symbols-outlined text-[24px]">forest</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-mono tracking-widest text-[#6cf8bb] uppercase font-bold">
              República de Costa Rica
            </span>
            <span className="text-xs text-[#a5d0bc] font-medium tracking-wide">
              Sistema de Bitácora de Campo &amp; Taxonomía
            </span>
          </div>
        </div>

        {/* Autor y Creador Pill en Header */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="px-3 py-1.5 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-md border border-[#6cf8bb]/40 flex items-center gap-2 shadow-sm transition-all">
            <div className="w-5 h-5 rounded-full bg-[#6cf8bb] text-[#002217] flex items-center justify-center">
              <span className="material-symbols-outlined text-[13px] font-bold">engineering</span>
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-[9px] text-[#a5d0bc] uppercase tracking-wider font-semibold font-mono">
                Elaborado por
              </span>
              <span className="text-xs font-bold text-white tracking-wide">
                {observerName || 'Ing. Carvajal V.'}
              </span>
            </div>
          </div>

          <ThemeSwitcher compact />

          {/* Badge en vivo de Sincronización en Tiempo Real en la Nube */}
          <button
            onClick={onOpenSyncBackup}
            className={`px-3 py-1.5 rounded-full backdrop-blur-md border text-xs font-mono font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer ${
              cloudSyncStatus === 'connected'
                ? 'bg-[#002217]/90 border-[#6cf8bb] text-[#6cf8bb] hover:bg-[#003825]'
                : cloudSyncStatus === 'syncing'
                ? 'bg-[#191c19]/90 border-amber-400 text-amber-300'
                : 'bg-black/60 border-zinc-600 text-zinc-300'
            }`}
            title="Sincronización en tiempo real entre iPad, Celular y Laptop"
          >
            <span
              className={`w-2 h-2 rounded-full ${
                cloudSyncStatus === 'connected'
                  ? 'bg-[#6cf8bb] shadow-[0_0_8px_#6cf8bb] animate-pulse'
                  : cloudSyncStatus === 'syncing'
                  ? 'bg-amber-400 animate-spin'
                  : 'bg-zinc-400'
              }`}
            />
            <span className="material-symbols-outlined text-[15px]">
              {cloudSyncStatus === 'connected' ? 'cloud_done' : cloudSyncStatus === 'syncing' ? 'sync' : 'cloud_off'}
            </span>
            <span>
              {cloudSyncStatus === 'connected'
                ? 'Nube en Vivo'
                : cloudSyncStatus === 'syncing'
                ? 'Sincronizando...'
                : 'Modo Offline'}
            </span>
            <span className="hidden sm:inline text-[10px] opacity-80">
              (iPad • Celular • PC)
            </span>
          </button>

          {/* Badge en vivo de Avistamientos Totales */}
          <div
            className="px-3 py-1.5 rounded-full bg-[#006c49]/80 backdrop-blur-md border border-[#6cf8bb]/50 text-white text-xs font-mono font-bold flex items-center gap-1.5 shadow-sm"
            title="Total acumulado de avistamientos en campo sincronizados"
          >
            <span className="material-symbols-outlined text-[15px] text-[#6cf8bb]">visibility</span>
            <span>{totalSightingsCount} Avistamientos</span>
          </div>

          <button
            onClick={onOpenDeviceProfile}
            className="px-3 py-1.5 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-md border border-[#6cf8bb]/50 text-[#6cf8bb] text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
            title="Gestión de este Dispositivo"
          >
            <span className="material-symbols-outlined text-[16px]">devices</span>
            <span className="hidden sm:inline">Dispositivo {deviceId ? `(${deviceId})` : ''}</span>
            <span className="w-1.5 h-1.5 rounded-full bg-[#6cf8bb] animate-pulse" />
          </button>

          <button
            onClick={onOpenSyncBackup}
            className="px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 text-[#6cf8bb] text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            title="Sincronización multi-dispositivo y respaldo JSON"
          >
            <span className="material-symbols-outlined text-[16px]">sync_saved_locally</span>
            <span className="hidden sm:inline">Sincronizar / JSON</span>
          </button>
        </div>
      </header>

      {/* Central Hero Body */}
      <div className="relative z-10 px-5 py-5 max-w-4xl mx-auto w-full flex flex-col gap-4 my-auto">
        {/* Main Title & Scientific Identity */}
        <div className="flex flex-col gap-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#6cf8bb]/15 border border-[#6cf8bb]/30 w-fit backdrop-blur-md">
              <span className="w-2 h-2 rounded-full bg-[#6cf8bb] animate-pulse" />
              <span className="text-xs font-mono font-bold text-[#6cf8bb] uppercase tracking-wider">
                Canopy Field Log • Versión de Campo
              </span>
            </div>

            {/* Insignia Multi-Dispositivo Independiente */}
            {onOpenDeviceProfile && (
              <button
                onClick={onOpenDeviceProfile}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 w-fit backdrop-blur-md text-xs text-[#6cf8bb] font-mono cursor-pointer transition-all"
                title="Configuración de este dispositivo (sin cuentas)"
              >
                <span className="material-symbols-outlined text-[14px]">smartphone</span>
                <span>Bitácora Local: <strong>{deviceId || 'DEV-ACTIVO'}</strong></span>
                <span className="text-[10px] text-white/70 hidden sm:inline">• Sincronizado</span>
              </button>
            )}
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-white drop-shadow-md">
            BioBitácora <span className="text-[#6cf8bb]">CR</span>
          </h1>

          <p className="text-sm sm:text-base text-[#e1e3dd] max-w-xl font-light leading-relaxed">
            Plataforma científica para registro biológico en Costa Rica con coordenadas WGS84,
            zonas de vida Holdridge, conteos estadísticos, bioacústica de campo y exportación estándar Darwin Core.
          </p>
        </div>

        {/* Panel Resumen de Conteos Globales en Tiempo Real */}
        <div className="grid grid-cols-3 gap-2 p-3 rounded-2xl bg-black/45 backdrop-blur-md border border-[#6cf8bb]/30 shadow-xl text-center">
          <div className="flex flex-col items-center justify-center py-1">
            <span className="text-[10px] uppercase font-mono text-[#a5d0bc] font-bold">Especies</span>
            <span className="text-2xl sm:text-3xl font-black text-white leading-tight">{specimensCount}</span>
            <span className="text-[9px] text-[#a5d0bc]/80 font-mono">en catálogo</span>
          </div>
          <div className="flex flex-col items-center justify-center py-1 border-x border-white/15">
            <span className="text-[10px] uppercase font-mono text-[#6cf8bb] font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#6cf8bb] animate-pulse" />
              Avistamientos
            </span>
            <span className="text-2xl sm:text-3xl font-black text-[#6cf8bb] leading-tight">{totalSightingsCount}</span>
            <span className="text-[9px] text-[#6cf8bb]/80 font-mono">entradas de campo</span>
          </div>
          <div className="flex flex-col items-center justify-center py-1">
            <span className="text-[10px] uppercase font-mono text-[#a5d0bc] font-bold">Individuos</span>
            <span className="text-2xl sm:text-3xl font-black text-white leading-tight">{totalIndividualsCount}</span>
            <span className="text-[9px] text-[#a5d0bc]/80 font-mono">contabilizados</span>
          </div>
        </div>

        {/* Featured Specimen Badge Card */}
        <div className="p-4 rounded-2xl bg-black/40 backdrop-blur-md border border-white/15 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xl">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 rounded-xl overflow-hidden border border-[#6cf8bb]/40 flex-shrink-0 shadow-inner">
              <img
                src={PERMANENT_COVER_IMAGE}
                alt="Ejemplar portada"
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = '/isthmohyla_nacientes.jpg';
                }}
              />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[10px] font-mono text-[#6cf8bb] font-bold flex items-center gap-1.5">
                <span>{currentSpecimen.catalogNumber}</span>
                <span className="text-white/60">•</span>
                <span className="text-[#a5d0bc]">
                  {Math.max(currentSpecimen.sightings?.length || 0, 1)} {Math.max(currentSpecimen.sightings?.length || 0, 1) === 1 ? 'avistamiento' : 'avistamientos'}
                </span>
              </span>
              <h2 className="text-base font-bold italic text-white truncate">
                {currentSpecimen.scientificName}
              </h2>
              <span className="text-xs text-[#c1c8c3] truncate">
                {currentSpecimen.commonName}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={onOpenDetail}
              className="flex-1 sm:flex-initial px-4 py-2 rounded-xl bg-[#6cf8bb] hover:bg-[#85f9c9] text-[#002116] text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">description</span>
              <span>Abrir Ficha Científica</span>
            </button>
          </div>
        </div>

        {/* Primary Interactive Action Grid (2x2 on desktop) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Card 1: Mapa SIG */}
          <button
            onClick={onOpenMap}
            className="p-3.5 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/20 backdrop-blur-md flex flex-col gap-2 text-left transition-all hover:scale-[1.02] shadow-lg group cursor-pointer"
          >
            <div className="w-8 h-8 rounded-xl bg-white/15 text-white flex items-center justify-center group-hover:bg-white group-hover:text-[#002116] transition-colors">
              <span className="material-symbols-outlined text-[19px]">explore</span>
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-xs sm:text-sm text-white flex items-center gap-1">
                Mapa SIG Costa Rica
                <span className="material-symbols-outlined text-[15px] text-white group-hover:translate-x-1 transition-transform">
                  arrow_forward
                </span>
              </span>
              <span className="text-[11px] text-[#c1c8c3] line-clamp-2">
                Capas satelitales y zonas biológicas
              </span>
            </div>
          </button>

          {/* Card 2: Registrar Nuevo en Campo (Ubicado después del Mapa) */}
          <button
            onClick={onOpenNewSpecimen}
            className="p-3.5 rounded-2xl bg-[#002e20]/80 hover:bg-[#003d2b] border border-[#6cf8bb]/30 backdrop-blur-md flex flex-col gap-2 text-left transition-all hover:scale-[1.02] shadow-lg group cursor-pointer"
          >
            <div className="w-8 h-8 rounded-xl bg-[#6cf8bb]/20 text-[#6cf8bb] flex items-center justify-center group-hover:bg-[#6cf8bb] group-hover:text-[#002116] transition-colors">
              <span className="material-symbols-outlined text-[19px]">add_location_alt</span>
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-xs sm:text-sm text-white flex items-center gap-1">
                Registrar Nuevo en Campo
                <span className="material-symbols-outlined text-[15px] text-[#6cf8bb] group-hover:translate-x-1 transition-transform">
                  arrow_forward
                </span>
              </span>
              <span className="text-[11px] text-[#a5d0bc] line-clamp-2">
                Captura GPS en vivo y zonas Holdridge
              </span>
            </div>
          </button>

          {/* Card 3: Colección & Catálogo con conteo total de avistamientos */}
          <button
            onClick={onOpenCatalog}
            className="p-3.5 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/20 backdrop-blur-md flex flex-col gap-2 text-left transition-all hover:scale-[1.02] shadow-lg group cursor-pointer"
          >
            <div className="w-8 h-8 rounded-xl bg-white/15 text-white flex items-center justify-center group-hover:bg-white group-hover:text-[#002116] transition-colors">
              <span className="material-symbols-outlined text-[19px]">grid_view</span>
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-xs sm:text-sm text-white flex items-center gap-1">
                Colección ({specimensCount} esp. • {totalSightingsCount} avist.)
                <span className="material-symbols-outlined text-[15px] text-white group-hover:translate-x-1 transition-transform">
                  arrow_forward
                </span>
              </span>
              <span className="text-[11px] text-[#c1c8c3] line-clamp-2">
                Fichas de fauna y flora con filtros
              </span>
            </div>
          </button>

          {/* Card 4: Estadísticas & Conteo */}
          <button
            onClick={onOpenStatistics || onOpenCatalog}
            className="p-3.5 rounded-2xl bg-[#004d33]/60 hover:bg-[#005a3c] border border-[#6cf8bb]/40 backdrop-blur-md flex flex-col gap-2 text-left transition-all hover:scale-[1.02] shadow-lg group cursor-pointer"
          >
            <div className="w-8 h-8 rounded-xl bg-[#6cf8bb]/20 text-[#6cf8bb] flex items-center justify-center group-hover:bg-[#6cf8bb] group-hover:text-[#002116] transition-colors">
              <span className="material-symbols-outlined text-[19px]">analytics</span>
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-xs sm:text-sm text-white flex items-center gap-1">
                Estadísticas &amp; Conteos
                <span className="material-symbols-outlined text-[15px] text-[#6cf8bb] group-hover:translate-x-1 transition-transform">
                  arrow_forward
                </span>
              </span>
              <span className="text-[11px] text-[#a5d0bc] line-clamp-2">
                Mamíferos, anfibios, aves, reptiles y gráficas
              </span>
            </div>
          </button>
        </div>
      </div>

      {/* Footer Scientific Status Bar */}
      <footer className="relative z-10 px-5 py-3 max-w-4xl mx-auto w-full border-t border-white/10 bg-black/40 backdrop-blur-md flex flex-wrap items-center justify-between gap-3 text-xs text-[#a5d0bc]">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-1.5 font-mono text-[11px]">
            <span className="material-symbols-outlined text-[15px] text-[#6cf8bb]">landscape</span>
            <span>13 Zonas Holdridge CR</span>
          </div>

          <div className="flex items-center gap-1.5 text-[11px]">
            <span className="material-symbols-outlined text-[15px] text-[#6cf8bb]">offline_pin</span>
            <span>Respaldo 100% Offline</span>
          </div>
        </div>

        <button
          onClick={onOpenSyncBackup}
          className="text-[#6cf8bb] hover:underline font-semibold flex items-center gap-1 cursor-pointer text-xs"
        >
          <span className="material-symbols-outlined text-[15px]">database</span>
          <span>Gestor de Datos JSON</span>
        </button>
      </footer>
    </div>
  );
};
