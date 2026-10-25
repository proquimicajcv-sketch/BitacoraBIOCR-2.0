/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { SpecimenRecord, BioacousticRecord, SightingEntry } from './types/specimen';
import { INITIAL_SPECIMENS } from './data/initialSpecimens';
import { CoverLandingView } from './components/CoverLandingView';
import { SpecimenDetailView } from './components/SpecimenDetailView';
import { CostaRicaMap } from './components/CostaRicaMap';
import { NewSpecimenModal } from './components/NewSpecimenModal';
import { SpecimenCatalogView } from './components/SpecimenCatalogView';
import { DarwinCoreExporterModal } from './components/DarwinCoreExporterModal';
import { SyncBackupModal } from './components/SyncBackupModal';
import { StatisticsView } from './components/StatisticsView';
import { DeviceProfileModal } from './components/DeviceProfileModal';
import { cacheAllSpecimensMedia } from './utils/offlineImageCache';
import {
  subscribeToSpecimens,
  saveSpecimenToCloud,
  deleteSpecimenFromCloud,
  batchSyncSpecimensToCloud,
  replaceFullSpecimensListInCloud,
  fetchSpecimensFromCloud,
  testFirestoreConnection,
} from './services/firestoreSync';

type ActiveView = 'COVER' | 'DETAIL' | 'MAP' | 'CATALOG' | 'STATISTICS';

const STORAGE_KEY = 'biobitacora_cr_specimens_v2';
const CHANGED_KEY = 'biobitacora_cr_has_user_changes';
const TIMESTAMP_KEY = 'biobitacora_cr_last_modified';
const DEVICE_ID_KEY = 'biobitacora_cr_device_id';
const OBSERVER_NAME_KEY = 'biobitacora_cr_observer_name';
const DEVICE_NAME_KEY = 'biobitacora_cr_device_name';

// Removed demo species IDs - permanently excluded from catalog
const UNWANTED_DUMMY_IDS = new Set([
  'cr-bio-2024-9104', // Oophaga pumilio
  'cr-bio-2024-7731', // Pharomachrus mocinno
  'cr-bio-2024-6420', // Morpho peleides
  'cr-bio-2025-0199', // Tapirus bairdii
  'cr-bio-2025-0312', // Bothriechis schlegelii
  'cr-bio-2025-0455', // Guarianthe skinneri
]);

function getOrCreateDeviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
      id = `DEV-${rand}`;
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch {
    return 'DEV-LOCAL';
  }
}

function mergeSpecimenLists(existingList: SpecimenRecord[], incomingList: SpecimenRecord[]): SpecimenRecord[] {
  const cleanExisting = (existingList || []).filter((e) => e && !UNWANTED_DUMMY_IDS.has(e.id));
  const cleanIncoming = (incomingList || []).filter((e) => e && !UNWANTED_DUMMY_IDS.has(e.id));
  if (cleanExisting.length === 0) return cleanIncoming;
  if (cleanIncoming.length === 0) return cleanExisting;

  const result: SpecimenRecord[] = [...cleanExisting];

  for (const incoming of cleanIncoming) {
    const idx = result.findIndex(
      (e) => (incoming.id && e.id === incoming.id) ||
             (incoming.scientificName && e.scientificName === incoming.scientificName)
    );

    if (idx === -1) {
      result.push(incoming);
    } else {
      const existing = result[idx];

      // Union of sightings by id: NEVER lose a sighting from either local or server!
      const existingSightings = Array.isArray(existing.sightings) ? existing.sightings : [];
      const incomingSightings = Array.isArray(incoming.sightings) ? incoming.sightings : [];

      const sightingMap = new Map<string, any>();
      for (const s of existingSightings) {
        if (s && s.id) sightingMap.set(s.id, s);
      }
      for (const s of incomingSightings) {
        if (s && s.id) {
          const old = sightingMap.get(s.id);
          if (!old) {
            sightingMap.set(s.id, s);
          } else {
            const incomingCurious = s.curiousFindingPhoto;
            const oldCurious = old.curiousFindingPhoto;
            const isMacho = s.id === 'sight-dota-20261009' || s.isCuriousFinding || s.curiousFindingTitle?.includes('Macho');
            let finalCuriousPhoto = incomingCurious;
            if (isMacho) {
              if (incomingCurious && !incomingCurious.includes('isthmohyla_nacientes') && !incomingCurious.includes('eye_zoom')) {
                finalCuriousPhoto = incomingCurious;
              } else if (oldCurious && !oldCurious.includes('isthmohyla_nacientes') && !oldCurious.includes('eye_zoom')) {
                finalCuriousPhoto = oldCurious;
              } else {
                finalCuriousPhoto = '/hallazgo_macho_un_ojo.jpg';
              }
            } else {
              const incomingIsCustom = incomingCurious && (incomingCurious.startsWith('/uploads/') || incomingCurious.startsWith('data:') || incomingCurious.startsWith('blob:'));
              const oldIsCustom = oldCurious && (oldCurious.startsWith('/uploads/') || oldCurious.startsWith('data:') || oldCurious.startsWith('blob:'));
              finalCuriousPhoto = incomingIsCustom ? incomingCurious : (incomingCurious || (oldIsCustom ? oldCurious : incomingCurious));
            }
            sightingMap.set(s.id, {
              ...old,
              ...s,
              curiousFindingPhoto: finalCuriousPhoto,
              photoUrls: finalCuriousPhoto ? [finalCuriousPhoto] : (s.photoUrls || old.photoUrls),
            });
          }
        }
      }

      const mergedSightings = Array.from(sightingMap.values()).sort((a, b) => {
        const dateA = a.date || a.timestamp || '';
        const dateB = b.date || b.timestamp || '';
        return dateB.localeCompare(dateA);
      });

      // Union of additional photos with custom photo protection
      const existingPhotos = Array.isArray(existing.additionalPhotos) ? existing.additionalPhotos : [];
      const incomingPhotos = Array.isArray(incoming.additionalPhotos) ? incoming.additionalPhotos : [];
      const photoMap = new Map<string, any>();
      for (const p of existingPhotos) {
        if (p && (p.id || p.label)) photoMap.set(p.id || p.label, p);
      }
      for (const p of incomingPhotos) {
        if (p && (p.id || p.label)) {
          const key = p.id || p.label;
          const old = photoMap.get(key);
          if (!old) {
            photoMap.set(key, p);
          } else {
            const isMacho = key === 'photo-4' || (old.label && old.label.toLowerCase().includes('macho tuerto')) || (p.label && p.label.toLowerCase().includes('macho tuerto'));
            let finalUrl = p.url;
            if (isMacho) {
              if (p.url && !p.url.includes('isthmohyla_nacientes') && !p.url.includes('eye_zoom')) {
                finalUrl = p.url;
              } else if (old.url && !old.url.includes('isthmohyla_nacientes') && !old.url.includes('eye_zoom')) {
                finalUrl = old.url;
              } else {
                finalUrl = '/hallazgo_macho_un_ojo.jpg';
              }
            } else {
              const incomingIsCustom = p.url && (p.url.startsWith('/uploads/') || p.url.startsWith('data:') || p.url.startsWith('blob:'));
              const oldIsCustom = old.url && (old.url.startsWith('/uploads/') || old.url.startsWith('data:') || old.url.startsWith('blob:'));
              finalUrl = incomingIsCustom ? p.url : (p.url || (oldIsCustom ? old.url : p.url));
            }
            photoMap.set(key, { ...old, ...p, url: finalUrl });
          }
        }
      }

      const incomingHero = incoming.heroImage;
      const oldHero = existing.heroImage;
      const incomingHeroCustom = incomingHero && (incomingHero.startsWith('/uploads/') || incomingHero.startsWith('data:'));
      const oldHeroCustom = oldHero && (oldHero.startsWith('/uploads/') || oldHero.startsWith('data:'));
      const finalHero = incomingHeroCustom ? incomingHero : (oldHeroCustom ? oldHero : incomingHero || oldHero);

      result[idx] = {
        ...existing,
        ...incoming,
        heroImage: finalHero,
        sightings: mergedSightings,
        additionalPhotos: Array.from(photoMap.values()),
      };
    }
  }

  return result;
}

function sanitizeSpecimens(list: SpecimenRecord[]): SpecimenRecord[] {
  // Purge unwanted demo species permanently
  const cleaned = (list || []).filter((item) => item && !UNWANTED_DUMMY_IDS.has(item.id));

  if (cleaned.length === 0) {
    return INITIAL_SPECIMENS;
  }

  let filtered = cleaned.map((item) => {
    if (
      item.scientificName === 'Isthmohyla nacientes' ||
      item.id === INITIAL_SPECIMENS[0].id
    ) {
      const existingSightings = item.sightings || [];
      const dotaSightExists = existingSightings.some((s) => s.id === 'sight-dota-20261009');
      let mergedSightings = dotaSightExists
        ? existingSightings
        : [INITIAL_SPECIMENS[0].sightings![0], ...existingSightings];

      // Auto-sort chronologically by date descending (most recent visit first)
      mergedSightings = [...mergedSightings].sort((a, b) => {
        const dateA = a.date || a.timestamp || '';
        const dateB = b.date || b.timestamp || '';
        return dateB.localeCompare(dateA);
      });

      // Find any user-uploaded custom photo for macho tuerto from additionalPhotos or sightings
      const rawPhotos = (item.additionalPhotos && item.additionalPhotos.length > 0)
        ? item.additionalPhotos
        : INITIAL_SPECIMENS[0].additionalPhotos;

      const existingP4 = (rawPhotos || []).find(
        (p) => p.id === 'photo-4' || (p.label && p.label.toLowerCase().includes('macho tuerto'))
      );
      const p4HasValidPhoto = existingP4?.url && !existingP4.url.includes('isthmohyla_nacientes') && !existingP4.url.includes('eye_zoom');

      const dotaSightRef = mergedSightings.find((s) => s.id === 'sight-dota-20261009' || s.isCuriousFinding || s.curiousFindingTitle?.includes('Macho'));
      const sightHasValidPhoto = dotaSightRef?.curiousFindingPhoto && !dotaSightRef.curiousFindingPhoto.includes('isthmohyla_nacientes') && !dotaSightRef.curiousFindingPhoto.includes('eye_zoom');

      // Best user custom photo, or permanent default macho tuerto (NEVER takes cover photo)
      let activeMachoPhoto = '/hallazgo_macho_un_ojo.jpg';
      const savedCustomMacho = typeof window !== 'undefined' ? localStorage.getItem('bio_macho_tuerto_custom_photo') : null;

      if (p4HasValidPhoto && existingP4?.url) {
        activeMachoPhoto = existingP4.url;
      } else if (sightHasValidPhoto && dotaSightRef?.curiousFindingPhoto) {
        activeMachoPhoto = dotaSightRef.curiousFindingPhoto;
      } else if (savedCustomMacho && !savedCustomMacho.includes('isthmohyla_nacientes') && !savedCustomMacho.includes('eye_zoom')) {
        activeMachoPhoto = savedCustomMacho;
      }

      // Ensure whatever custom photo is active is permanently saved locally and synchronized
      if (activeMachoPhoto && activeMachoPhoto !== '/hallazgo_macho_un_ojo.jpg') {
        try {
          localStorage.setItem('bio_macho_tuerto_custom_photo', activeMachoPhoto);
        } catch {}
      }

      // 1. Ensure sight-dota-20261009 keeps user custom photo or default macho tuerto
      mergedSightings = mergedSightings.map((s) => {
        if (s.id === 'sight-dota-20261009' || s.isCuriousFinding || s.curiousFindingTitle?.includes('Macho')) {
          return {
            ...s,
            curiousFindingPhoto: activeMachoPhoto,
            photoUrls: activeMachoPhoto ? [activeMachoPhoto] : ['/hallazgo_macho_un_ojo.jpg'],
          };
        }
        return s;
      });

      // 2. Ensure photo-3 (Detalle Ocular) ALWAYS keeps the eye zoom macro
      let cleanedPhotos = (rawPhotos || []).map((p) => {
        if (p.id === 'photo-3' || p.label === 'Detalle Ocular') {
          return {
            ...p,
            url: '/isthmohyla_nacientes_eye_zoom.jpg',
            label: 'Detalle Ocular',
            description: 'Macro zoom de alta precisión y nitidez del ojo de Isthmohyla nacientes. Se aprecia el iris cobrizo-dorado metálico característico con reticulaciones oscuras dendríticas, pupila horizontal adaptada a baja luminosidad en quebradas y piel verde esmeralda con gránulos cutáneos húmedos.',
          };
        }
        return p;
      });

      // 3. Ensure photo-4 (Hallazgo: Macho Tuerto) is permanently synchronized and NEVER takes cover photo
      const p4Idx = cleanedPhotos.findIndex(
        (p) => p.id === 'photo-4' || p.label.toLowerCase().includes('macho tuerto')
      );
      if (p4Idx >= 0) {
        cleanedPhotos[p4Idx] = {
          ...cleanedPhotos[p4Idx],
          id: 'photo-4',
          url: activeMachoPhoto,
          label: 'Hallazgo: Macho Tuerto',
          description: cleanedPhotos[p4Idx].description || 'Hallazgo curioso en Santa María de Dota (Viernes 9): Macho adulto de Isthmohyla nacientes al que le falta un ojo (anoftalmia/cicatrización natural). Era el que cantaba con mayor potencia acústica a 45 cm del caudal.',
        };
      } else {
        cleanedPhotos.push({
          id: 'photo-4',
          url: activeMachoPhoto,
          label: 'Hallazgo: Macho Tuerto',
          description: 'Hallazgo curioso en Santa María de Dota (Viernes 9): Macho adulto de Isthmohyla nacientes al que le falta un ojo (anoftalmia/cicatrización natural). Era el que cantaba con mayor potencia acústica a 45 cm del caudal.',
        });
      }

      return {
        ...item,
        heroImage: '/isthmohyla_nacientes.jpg',
        additionalPhotos: cleanedPhotos,
        sightings: mergedSightings,
        morphometrics: {
          ...item.morphometrics,
          courtshipAndMating: INITIAL_SPECIMENS[0].morphometrics.courtshipAndMating,
        },
      };
    }

    // Toda ficha catalogada representa por sí misma al menos 1 avistamiento inicial de campo.
    // Si la lista de avistamientos está vacía, aseguramos la entrada del avistamiento inicial.
    const currentSightings = item.sightings || [];
    if (currentSightings.length === 0) {
      const initSighting: SightingEntry = {
        id: `sight-init-${item.id}`,
        timestamp: `${item.collectionDate || 'Fecha de registro'} ${item.collectionTime || ''}`.trim(),
        date: item.collectionDate || new Date().toISOString().slice(0, 10),
        observer: item.collector || 'Ing. Carvajal V.',
        locality: item.georeference?.locality || 'Costa Rica',
        coordinates: item.georeference ? `${item.georeference.latitude}° N, ${item.georeference.longitude}° W` : undefined,
        count: 1,
        individualsCount: 1,
        microhabitat: item.georeference?.microhabitat || 'Microhábitat registrado en campo',
        weather: 'Condición ambiental de campo',
        behaviorObserved: 'Individuo observado y catalogado en campo.',
        notes: 'Avistamiento y registro inicial de la especie en la bitácora.',
        vitalityStatus: 'VIVO',
        lifeStage: 'ADULTO',
      };
      return {
        ...item,
        sightings: [initSighting],
      };
    }

    return item;
  });

  // Garantizar que Isthmohyla nacientes sea el primer espécimen emblema si está presente
  const nacientesIdx = filtered.findIndex(
    (s) => s.scientificName === 'Isthmohyla nacientes' || s.id === INITIAL_SPECIMENS[0].id
  );
  if (nacientesIdx > 0) {
    const [nac] = filtered.splice(nacientesIdx, 1);
    filtered.unshift(nac);
  }

  return filtered;
}

export default function App() {
  const [deviceId] = useState<string>(() => getOrCreateDeviceId());
  const [observerName, setObserverName] = useState<string>(() => {
    try {
      const stored = localStorage.getItem(OBSERVER_NAME_KEY);
      if (!stored || stored.includes('Carvajal')) {
        localStorage.setItem(OBSERVER_NAME_KEY, 'Ing. Carvajal V.');
        return 'Ing. Carvajal V.';
      }
      return stored;
    } catch {
      return 'Ing. Carvajal V.';
    }
  });
  const [deviceName, setDeviceName] = useState<string>(() => {
    try {
      return localStorage.getItem(DEVICE_NAME_KEY) || 'Dispositivo de Campo';
    } catch {
      return 'Dispositivo de Campo';
    }
  });
  const [isDeviceModalOpen, setIsDeviceModalOpen] = useState(false);
  const [syncStatusToast, setSyncStatusToast] = useState<string | null>(null);

  const [specimens, setSpecimens] = useState<SpecimenRecord[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        let parsed: SpecimenRecord[] = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const sanitized = sanitizeSpecimens(parsed);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
          return sanitized;
        }
      }
    } catch {
      // Ignore
    }
    return INITIAL_SPECIMENS;
  });

  const [currentSpecimen, setCurrentSpecimen] = useState<SpecimenRecord>(specimens[0]);
  const [activeView, setActiveView] = useState<ActiveView>('COVER');

  // Modals
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [editingSpecimen, setEditingSpecimen] = useState<SpecimenRecord | null>(null);
  const [isDwcModalOpen, setIsDwcModalOpen] = useState(false);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [isSyncingServer, setIsSyncingServer] = useState(false);
  const [cloudSyncStatus, setCloudSyncStatus] = useState<'connected' | 'syncing' | 'offline'>('syncing');
  const [lastCloudSyncTime, setLastCloudSyncTime] = useState<string>('');
  const [presetNewCoords, setPresetNewCoords] = useState<{
    lat: number;
    lng: number;
    locality?: string;
    lifeZone?: string;
  } | undefined>(undefined);

  // Centralized robust persistence helper (immediate local + Google Cloud Firestore + server sync)
  const persistSpecimens = async (updated: SpecimenRecord[], isReplace: boolean = false) => {
    const sanitized = sanitizeSpecimens(updated);
    setSpecimens(sanitized);
    const now = Date.now();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
      localStorage.setItem(TIMESTAMP_KEY, String(now));
      localStorage.setItem(CHANGED_KEY, 'true');
    } catch (e) {
      console.warn('LocalStorage error:', e);
    }

    // 1. Instantly push to Google Cloud Firestore (all devices sync in milliseconds)
    const cloudPromise = isReplace
      ? replaceFullSpecimensListInCloud(sanitized)
      : batchSyncSpecimensToCloud(sanitized);

    cloudPromise
      .then(() => {
        setCloudSyncStatus('connected');
        setLastCloudSyncTime(new Date().toLocaleTimeString('es-CR'));
        try {
          localStorage.removeItem(CHANGED_KEY);
        } catch {}
      })
      .catch((err) => {
        console.warn('Firestore offline fallback:', err);
        setCloudSyncStatus('offline');
      });

    // 2. Also save to server file backup so both cloud and container stay in sync
    try {
      fetch('/api/database/specimens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ specimens: sanitized, lastModified: now, deviceId, replace: isReplace }),
      }).catch(() => {});
    } catch {}

    cacheAllSpecimensMedia(sanitized).catch(() => {});
  };

  // Keep currentSpecimen synchronized whenever specimens changes (e.g. after adding a sighting)
  useEffect(() => {
    if (currentSpecimen && specimens.length > 0) {
      const fresh = specimens.find((s) => s.id === currentSpecimen.id);
      if (fresh) {
        if (JSON.stringify(fresh) !== JSON.stringify(currentSpecimen)) {
          setCurrentSpecimen(fresh);
        }
      } else {
        setCurrentSpecimen(specimens[0]);
      }
    }
  }, [specimens]);

  // Real-time Cloud Synchronization (Google Cloud Firestore)
  // Ensures iPad, iPhone/Android, and Laptops stay in sync in real time
  useEffect(() => {
    testFirestoreConnection();

    const unsubscribe = subscribeToSpecimens(
      (cloudSpecimens) => {
        setLastCloudSyncTime(new Date().toLocaleTimeString('es-CR'));

        if (cloudSpecimens.length === 0) {
          // If cloud database is newly initialized, seed it with current local/initial specimens
          setSpecimens((current) => {
            const listToUpload = current && current.length > 0 ? sanitizeSpecimens(current) : INITIAL_SPECIMENS;
            batchSyncSpecimensToCloud(listToUpload).catch((err) => console.warn('Cloud seed error:', err));
            return listToUpload;
          });
          return;
        }

        setSpecimens((prevLocal) => {
          const hasLocalChanges = localStorage.getItem(CHANGED_KEY) === 'true';
          const incomingClean = sanitizeSpecimens(cloudSpecimens);

          let finalCleanList: SpecimenRecord[];
          if (!hasLocalChanges) {
            // Cloud is authoritative source of truth across all devices
            finalCleanList = incomingClean;
          } else {
            finalCleanList = sanitizeSpecimens(mergeSpecimenLists(prevLocal, incomingClean));
          }

          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(finalCleanList));
            localStorage.setItem(TIMESTAMP_KEY, String(Date.now()));
          } catch {}

          cacheAllSpecimensMedia(finalCleanList).catch(() => {});
          return finalCleanList;
        });
      },
      (status) => {
        setCloudSyncStatus(status === 'error' ? 'offline' : status);
      }
    );

    return () => {
      unsubscribe();
    };
  }, []);

  // Multi-device central server synchronization handler
  const syncWithServer = useCallback(async (silent = true) => {
    try {
      const res = await fetch('/api/database/specimens');
      const data = await res.json();
      if (data.success && Array.isArray(data.data) && data.data.length > 0) {
        setSpecimens((prevLocal) => {
          const hasLocalChanges = localStorage.getItem(CHANGED_KEY) === 'true';
          const serverClean = sanitizeSpecimens(data.data);

          let finalCleanList: SpecimenRecord[];
          if (!hasLocalChanges) {
            finalCleanList = serverClean;
          } else {
            finalCleanList = sanitizeSpecimens(mergeSpecimenLists(prevLocal, serverClean));
          }

          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(finalCleanList));
            if (data.lastModified) {
              localStorage.setItem(TIMESTAMP_KEY, String(data.lastModified));
            }
          } catch {}

          cacheAllSpecimensMedia(finalCleanList).catch(() => {});
          return finalCleanList;
        });

        if (!silent) {
          setSyncStatusToast(`¡Sincronizado! Se cargaron y unificaron todos los avistamientos de la bitácora.`);
          setTimeout(() => setSyncStatusToast(null), 3500);
        }
      }
    } catch {
      // Offline fallback: continue using local storage
    }
  }, [deviceId]);

  // Multi-device listeners: sync on mount, window focus, and visibility change
  useEffect(() => {
    syncWithServer(true);

    const onFocus = () => syncWithServer(true);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        syncWithServer(true);
      }
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [syncWithServer]);

  // Handle saving new or edited specimen
  const handleSaveSpecimen = (savedSpecimen: SpecimenRecord) => {
    const existsIndex = specimens.findIndex((s) => s.id === savedSpecimen.id);
    let updated: SpecimenRecord[];
    if (existsIndex >= 0) {
      updated = [...specimens];
      updated[existsIndex] = savedSpecimen;
    } else {
      updated = [savedSpecimen, ...specimens];
    }

    persistSpecimens(updated);
    setCurrentSpecimen(savedSpecimen);
    setEditingSpecimen(null);
  };

  // Handle deleting specimen
  const handleDeleteSpecimen = (specimenId: string) => {
    const filtered = specimens.filter((s) => s.id !== specimenId);
    if (currentSpecimen.id === specimenId) {
      if (filtered.length > 0) {
        setCurrentSpecimen(filtered[0]);
      } else {
        setCurrentSpecimen(INITIAL_SPECIMENS[0]);
      }
      setActiveView('CATALOG');
    }

    deleteSpecimenFromCloud(specimenId).catch((err) => console.warn('Cloud delete error:', err));
    persistSpecimens(filtered);
  };

  // Handle updating bioacoustics directly
  const handleUpdateBioacoustics = (specimenId: string, bioacoustics?: BioacousticRecord) => {
    const updated = specimens.map((s) => {
      if (s.id === specimenId) {
        const item = { ...s, bioacoustics };
        if (currentSpecimen.id === specimenId) {
          setCurrentSpecimen(item);
        }
        return item;
      }
      return s;
    });
    persistSpecimens(updated);
  };

  // Handle importing JSON records and broadcasting to all devices
  const handleImportSpecimens = (imported: SpecimenRecord[], replace: boolean) => {
    let result: SpecimenRecord[];
    if (replace) {
      result = sanitizeSpecimens(imported);
    } else {
      const sanitizedImported = sanitizeSpecimens(imported);
      const existingIds = new Set(specimens.map((s) => s.id));
      const uniqueNew = sanitizedImported.filter((s) => !existingIds.has(s.id));
      result = [...specimens, ...uniqueNew];
    }
    persistSpecimens(result, replace);
    if (result.length > 0) {
      setCurrentSpecimen(result[0]);
    }

    // Immediately push to central database so all other devices receive this JSON data
    fetch('/api/database/import-json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ specimens: result, merge: !replace }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setSyncStatusToast(`¡Bitácora JSON importada y sincronizada en todos tus dispositivos (${result.length} registros)!`);
        }
      })
      .catch(() => {});
  };

  // Manual server sync action (accessible via modal / header)
  const handleSyncServer = async () => {
    setIsSyncingServer(true);
    try {
      // 1. Fetch latest documents directly from Google Cloud Firestore
      let cloudList: SpecimenRecord[] = [];
      try {
        cloudList = await fetchSpecimensFromCloud();
      } catch (cloudErr) {
        console.warn('Direct cloud fetch warning:', cloudErr);
      }

      if (cloudList && cloudList.length > 0) {
        const sanitizedCloud = sanitizeSpecimens(cloudList);
        setSpecimens(sanitizedCloud);
        if (sanitizedCloud.length > 0) {
          setCurrentSpecimen(sanitizedCloud[0]);
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitizedCloud));
        localStorage.setItem(TIMESTAMP_KEY, String(Date.now()));
        localStorage.removeItem(CHANGED_KEY);
        setCloudSyncStatus('connected');
        setLastCloudSyncTime(new Date().toLocaleTimeString('es-CR'));

        // Mirror to server container backup as well
        fetch('/api/database/specimens', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ specimens: sanitizedCloud, deviceId, lastModified: Date.now(), replace: true }),
        }).catch(() => {});

        cacheAllSpecimensMedia(sanitizedCloud).catch(() => {});

        setSyncStatusToast(`¡Actualizado con la nube! Se cargaron ${sanitizedCloud.length} especie(s) y todos sus avistamientos.`);
      } else {
        // Cloud is empty, push current sanitized local data to initialize cloud
        const sanitized = sanitizeSpecimens(specimens);
        await batchSyncSpecimensToCloud(sanitized);
        setCloudSyncStatus('connected');
        setLastCloudSyncTime(new Date().toLocaleTimeString('es-CR'));

        // Also sync to server container
        await fetch('/api/database/specimens', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ specimens: sanitized, deviceId, lastModified: Date.now() }),
        });

        setSyncStatusToast('¡Sincronizado! Tu bitácora local fue enviada a la nube de Google Cloud.');
      }
    } catch {
      // Fallback: try container server sync
      try {
        const res = await fetch('/api/database/specimens');
        const data = await res.json();
        if (data.success && Array.isArray(data.data) && data.data.length > 0) {
          const sanitized = sanitizeSpecimens(data.data);
          setSpecimens(sanitized);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
          setSyncStatusToast(`Sincronizado desde el servidor central (${sanitized.length} registros).`);
        } else {
          setSyncStatusToast('Modo offline: tus datos siguen protegidos en este equipo.');
        }
      } catch {
        setSyncStatusToast('Modo offline: tus datos siguen protegidos en este equipo.');
      }
    } finally {
      setIsSyncingServer(false);
      setTimeout(() => setSyncStatusToast(null), 4000);
    }
  };

  const handleResetToInitial = () => {
    persistSpecimens(INITIAL_SPECIMENS);
    setCurrentSpecimen(INITIAL_SPECIMENS[0]);
    localStorage.removeItem(CHANGED_KEY);
    setSyncStatusToast('Bitácora de este equipo restablecida al catálogo de referencia limpio.');
    setTimeout(() => setSyncStatusToast(null), 3500);
  };

  const handleOpenEdit = (specimen: SpecimenRecord) => {
    setEditingSpecimen(specimen);
    setIsNewModalOpen(true);
  };

  const handleOpenNewFromCoords = (coords: {
    lat: number;
    lng: number;
    locality: string;
    lifeZone: string;
  }) => {
    setEditingSpecimen(null);
    setPresetNewCoords(coords);
    setIsNewModalOpen(true);
  };

  return (
    <div className="relative min-h-screen w-full bg-[#f8faf4] text-[#191c19] flex flex-col font-sans">
      {/* Dynamic View Display */}
      <main className="flex-1 w-full flex flex-col">
        {activeView === 'COVER' && (
          <CoverLandingView
            currentSpecimen={
              specimens.find((s) => s.scientificName === 'Isthmohyla nacientes' || s.id === INITIAL_SPECIMENS[0].id) ||
              specimens[0] ||
              INITIAL_SPECIMENS[0]
            }
            specimensCount={specimens.length}
            totalSightingsCount={specimens.reduce((acc, s) => acc + Math.max(s.sightings?.length || 0, 1), 0)}
            totalIndividualsCount={specimens.reduce((acc, s) => {
              const list = s.sightings || [];
              return acc + (list.length > 0 ? list.reduce((sub, sight) => sub + (sight.individualsCount || sight.count || 1), 0) : 1);
            }, 0)}
            onOpenDetail={() => {
              const emblem = specimens.find((s) => s.scientificName === 'Isthmohyla nacientes' || s.id === INITIAL_SPECIMENS[0].id) || specimens[0];
              setCurrentSpecimen(emblem);
              setActiveView('DETAIL');
            }}
            onOpenMap={() => setActiveView('MAP')}
            onOpenCatalog={() => setActiveView('CATALOG')}
            onOpenStatistics={() => setActiveView('STATISTICS')}
            onOpenNewSpecimen={() => {
              setEditingSpecimen(null);
              setPresetNewCoords(undefined);
              setIsNewModalOpen(true);
            }}
            onOpenSyncBackup={() => setIsSyncModalOpen(true)}
            onOpenDeviceProfile={() => setIsDeviceModalOpen(true)}
            deviceId={deviceId}
            observerName={observerName}
            cloudSyncStatus={cloudSyncStatus}
            lastCloudSyncTime={lastCloudSyncTime}
          />
        )}

        {activeView === 'DETAIL' && (
          <SpecimenDetailView
            specimen={currentSpecimen}
            onBack={() => setActiveView('CATALOG')}
            onGoHome={() => setActiveView('COVER')}
            onSaveSpecimen={handleSaveSpecimen}
            onEdit={handleOpenEdit}
            onOpenMap={(spec) => {
              setCurrentSpecimen(spec);
              setActiveView('MAP');
            }}
            onOpenDarwinCoreModal={(spec) => {
              setCurrentSpecimen(spec);
              setIsDwcModalOpen(true);
            }}
            onDelete={handleDeleteSpecimen}
            onUpdateBioacoustics={handleUpdateBioacoustics}
            currentObserverName={observerName}
          />
        )}

        {activeView === 'MAP' && (
          <div className="flex flex-col w-full h-[calc(100vh-64px)] relative">
            {/* Map Header */}
            <div className="h-14 px-4 bg-[#002217] text-white flex items-center justify-between z-30">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveView('DETAIL')}
                  className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-white/10 text-white cursor-pointer"
                  title="Volver a la ficha de espécimen"
                >
                  <span className="material-symbols-outlined text-[20px]">arrow_back</span>
                </button>
                {/* Ícono superior para regresar a Inicio */}
                <button
                  onClick={() => setActiveView('COVER')}
                  className="flex items-center gap-1.5 hover:opacity-85 transition-all cursor-pointer group text-left"
                  title="Ir a Inicio / Portada"
                >
                  <div className="w-7 h-7 rounded-lg bg-white/10 group-hover:bg-[#006c49] flex items-center justify-center text-[#6cf8bb] group-hover:text-white transition-colors">
                    <span className="material-symbols-outlined text-[18px]">cottage</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <h2 className="font-bold text-sm tracking-tight text-white group-hover:text-[#6cf8bb] transition-colors">
                      SIG de Biodiversidad CR
                    </h2>
                    <span className="text-[10px] text-[#a5d0bc] font-mono">(Inicio)</span>
                  </div>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsSyncModalOpen(true)}
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-[#6cf8bb] text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                  title="Respaldo JSON y sincronización"
                >
                  <span className="material-symbols-outlined text-[18px]">sync_saved_locally</span>
                </button>
                <button
                  onClick={() => {
                    setEditingSpecimen(null);
                    setPresetNewCoords(undefined);
                    setIsNewModalOpen(true);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-[#6cf8bb] text-[#002116] font-bold text-xs flex items-center gap-1 shadow hover:bg-[#a5d0bc] transition-all cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">add_location_alt</span>
                  <span className="hidden sm:inline">Nuevo Registro</span>
                </button>
              </div>
            </div>

            {/* Full Costa Rica Map */}
            <div className="flex-1 w-full h-full relative">
              <CostaRicaMap
                specimens={specimens}
                onSelectSpecimen={(spec) => {
                  setCurrentSpecimen(spec);
                  setActiveView('DETAIL');
                }}
                onOpenNewSpecimen={handleOpenNewFromCoords}
                initialCoords={{
                  lat: currentSpecimen.georeference.latitude,
                  lng: currentSpecimen.georeference.longitude,
                }}
              />
            </div>
          </div>
        )}

        {activeView === 'CATALOG' && (
          <SpecimenCatalogView
            specimens={specimens}
            onSelectSpecimen={(spec) => {
              setCurrentSpecimen(spec);
              setActiveView('DETAIL');
            }}
            onOpenNew={() => {
              setEditingSpecimen(null);
              setPresetNewCoords(undefined);
              setIsNewModalOpen(true);
            }}
            onOpenMap={() => setActiveView('MAP')}
            onOpenDarwinCore={() => setIsDwcModalOpen(true)}
            onOpenSyncBackup={() => setIsSyncModalOpen(true)}
            onOpenStatistics={() => setActiveView('STATISTICS')}
            onGoHome={() => setActiveView('COVER')}
            onDeleteSpecimen={handleDeleteSpecimen}
          />
        )}

        {activeView === 'STATISTICS' && (
          <StatisticsView
            specimens={specimens}
            onSelectSpecimen={(spec) => {
              setCurrentSpecimen(spec);
              setActiveView('DETAIL');
            }}
            onOpenCatalog={() => setActiveView('CATALOG')}
            onOpenNewSpecimen={() => {
              setEditingSpecimen(null);
              setPresetNewCoords(undefined);
              setIsNewModalOpen(true);
            }}
            onGoHome={() => setActiveView('COVER')}
          />
        )}
      </main>

      {/* Bottom Global Navigation Bar: 3 ítems izquierda | BOTÓN CENTRAL [+] | 3 ítems derecha */}
      <nav className="fixed bottom-0 inset-x-0 z-50 bg-[#f8faf4]/95 backdrop-blur-xl border-t border-[#c1c8c3]/40 shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
        <div className="h-16 max-w-xl mx-auto px-2 sm:px-3 flex items-center justify-between">
          {/* 1. Portada */}
          <button
            onClick={() => setActiveView('COVER')}
            className={`flex flex-col items-center gap-0.5 text-[10px] sm:text-[11px] font-semibold transition-all cursor-pointer ${
              activeView === 'COVER'
                ? 'text-[#002217] scale-105 font-bold'
                : 'text-[#717974] hover:text-[#191c19]'
            }`}
          >
            <span
              className={`material-symbols-outlined text-[20px] sm:text-[21px] ${
                activeView === 'COVER' ? 'text-[#006c49]' : ''
              }`}
            >
              cottage
            </span>
            <span>Portada</span>
          </button>

          {/* 2. Ficha */}
          <button
            onClick={() => setActiveView('DETAIL')}
            className={`flex flex-col items-center gap-0.5 text-[10px] sm:text-[11px] font-semibold transition-all cursor-pointer ${
              activeView === 'DETAIL'
                ? 'text-[#002217] scale-105 font-bold'
                : 'text-[#717974] hover:text-[#191c19]'
            }`}
          >
            <span
              className={`material-symbols-outlined text-[20px] sm:text-[21px] ${
                activeView === 'DETAIL' ? 'text-[#006c49]' : ''
              }`}
            >
              description
            </span>
            <span>Ficha</span>
          </button>

          {/* 3. Mapa CR (Ahora antes del botón central de registro) */}
          <button
            onClick={() => setActiveView('MAP')}
            className={`flex flex-col items-center gap-0.5 text-[10px] sm:text-[11px] font-semibold transition-all cursor-pointer ${
              activeView === 'MAP'
                ? 'text-[#002217] scale-105 font-bold'
                : 'text-[#717974] hover:text-[#191c19]'
            }`}
          >
            <span
              className={`material-symbols-outlined text-[20px] sm:text-[21px] ${
                activeView === 'MAP' ? 'text-[#006c49]' : ''
              }`}
            >
              map
            </span>
            <span>Mapa CR</span>
          </button>

          {/* 4. BOTÓN CENTRAL: Registrar nuevo espécimen (UBICADO EXACTAMENTE DESPUÉS DEL MAPA, TOTALMENTE CENTRADO) */}
          <button
            onClick={() => {
              setEditingSpecimen(null);
              setPresetNewCoords(undefined);
              setIsNewModalOpen(true);
            }}
            className="w-11 h-11 -mt-4 rounded-full bg-[#002217] hover:bg-[#0f382a] text-[#6cf8bb] flex items-center justify-center shadow-xl active:scale-95 transition-all cursor-pointer border-2 border-white flex-shrink-0"
            title="Registrar nuevo espécimen con GPS o mapa offline"
          >
            <span className="material-symbols-outlined text-[24px]">add</span>
          </button>

          {/* 5. Colección */}
          <button
            onClick={() => setActiveView('CATALOG')}
            className={`flex flex-col items-center gap-0.5 text-[10px] sm:text-[11px] font-semibold transition-all cursor-pointer ${
              activeView === 'CATALOG'
                ? 'text-[#002217] scale-105 font-bold'
                : 'text-[#717974] hover:text-[#191c19]'
            }`}
          >
            <span
              className={`material-symbols-outlined text-[20px] sm:text-[21px] ${
                activeView === 'CATALOG' ? 'text-[#006c49]' : ''
              }`}
            >
              grid_view
            </span>
            <span>Colección</span>
          </button>

          {/* 6. Estadística */}
          <button
            onClick={() => setActiveView('STATISTICS')}
            className={`flex flex-col items-center gap-0.5 text-[10px] sm:text-[11px] font-semibold transition-all cursor-pointer ${
              activeView === 'STATISTICS'
                ? 'text-[#002217] scale-105 font-bold'
                : 'text-[#717974] hover:text-[#191c19]'
            }`}
          >
            <span
              className={`material-symbols-outlined text-[20px] sm:text-[21px] ${
                activeView === 'STATISTICS' ? 'text-[#006c49]' : ''
              }`}
            >
              analytics
            </span>
            <span>Estadística</span>
          </button>

          {/* 7. Respaldo */}
          <button
            onClick={() => setIsSyncModalOpen(true)}
            className="flex flex-col items-center gap-0.5 text-[10px] sm:text-[11px] font-semibold text-[#717974] hover:text-[#002217] transition-all cursor-pointer"
            title="Respaldo JSON y Sincronización multi-dispositivo"
          >
            <span className="material-symbols-outlined text-[20px] sm:text-[21px] text-[#006c49]">sync_saved_locally</span>
            <span>Respaldo</span>
          </button>
        </div>
      </nav>

      {/* New / Edit Specimen Modal */}
      <NewSpecimenModal
        isOpen={isNewModalOpen}
        onClose={() => {
          setIsNewModalOpen(false);
          setEditingSpecimen(null);
          setPresetNewCoords(undefined);
        }}
        onSave={handleSaveSpecimen}
        onDelete={handleDeleteSpecimen}
        initialCoords={presetNewCoords}
        editingSpecimen={editingSpecimen}
        defaultCollector={observerName}
      />

      {/* Darwin Core Exporter Modal */}
      <DarwinCoreExporterModal
        isOpen={isDwcModalOpen}
        onClose={() => setIsDwcModalOpen(false)}
        specimen={currentSpecimen}
        allSpecimens={specimens}
      />

      {/* Sync & Backup JSON Modal */}
      <SyncBackupModal
        isOpen={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
        specimens={specimens}
        onImportSpecimens={handleImportSpecimens}
        onSyncServer={handleSyncServer}
        isSyncingServer={isSyncingServer}
        deviceId={deviceId}
        cloudSyncStatus={cloudSyncStatus}
        lastCloudSyncTime={lastCloudSyncTime}
      />

      {/* Device & Observer Profile Modal */}
      <DeviceProfileModal
        isOpen={isDeviceModalOpen}
        onClose={() => setIsDeviceModalOpen(false)}
        deviceId={deviceId}
        observerName={observerName}
        onSaveObserverName={(newName) => {
          setObserverName(newName);
          try {
            localStorage.setItem(OBSERVER_NAME_KEY, newName);
          } catch {}
        }}
        deviceName={deviceName}
        onSaveDeviceName={(newDev) => {
          setDeviceName(newDev);
          try {
            localStorage.setItem(DEVICE_NAME_KEY, newDev);
          } catch {}
        }}
        specimensCount={specimens.length}
        totalSightingsCount={specimens.reduce((acc, s) => acc + Math.max(s.sightings?.length || 0, 1), 0)}
        onResetToInitial={handleResetToInitial}
        onOpenSyncBackup={() => setIsSyncModalOpen(true)}
      />

      {/* Toast Notification */}
      {syncStatusToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[200] max-w-md w-[92%] bg-[#002217] text-[#6cf8bb] px-4 py-3 rounded-2xl shadow-2xl border border-[#6cf8bb]/40 flex items-center justify-between text-xs font-bold animate-in fade-in">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">verified</span>
            <span>{syncStatusToast}</span>
          </div>
          <button onClick={() => setSyncStatusToast(null)} className="text-white hover:text-[#6cf8bb] cursor-pointer">
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      )}
    </div>
  );
}
