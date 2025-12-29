# Frontend - Recalculate Snapshots Button Implementation

## Cambios Realizados

### 1. Componente React (`AdminBalanceEvents.tsx`)

#### Nuevos Estados:
```typescript
const [recalculatingSnapshots, setRecalculatingSnapshots] = useState(false);
const [snapshotSuccess, setSnapshotSuccess] = useState('');
const [snapshotError, setSnapshotError] = useState('');
```

#### Nueva Función:
```typescript
const handleRecalculateSnapshots = async () => {
  setRecalculatingSnapshots(true);
  setSnapshotError('');
  setSnapshotSuccess('');

  try {
    const response = await api.post('/statistics/history/recalculate-snapshots');
    
    setSnapshotSuccess(
      t('snapshots_recalculated_success') || 
      `Historical snapshots recalculated successfully. Created ${response.data.totalSnapshots} snapshots.`
    );
  } catch (err: any) {
    setSnapshotError(err.response?.data?.error || t('error_recalculating_snapshots') || 'Error recalculating snapshots');
  } finally {
    setRecalculatingSnapshots(false);
  }
};
```

#### UI Changes:
- ✅ Nuevo botón "Recalculate Snapshots" en la sección de eventos
- ✅ Alertas de éxito/error para la acción
- ✅ Estado de carga durante el recálculo
- ✅ Tooltip descriptivo

### 2. Estilos CSS (`AdminBalanceEvents.css`)

```css
.events-section-controls {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.btn-recalculate {
  padding: 10px 16px;
  background: #3498db;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 0.95em;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn-recalculate:hover:not(:disabled) {
  background: #2980b9;
  box-shadow: 0 4px 12px rgba(52, 152, 219, 0.3);
}

.btn-recalculate:disabled {
  background: #95a5a6;
  cursor: not-allowed;
  opacity: 0.7;
}
```

### 3. Traducciones Multiidioma

Se agregaron las siguientes claves de traducción en todos los idiomas soportados (EN, ES, DE, RU, ZH):

| Clave | Descripción |
|-------|-------------|
| `recalculate_snapshots` | Etiqueta del botón |
| `recalculating` | Estado de carga |
| `snapshots_recalculated_success` | Mensaje de éxito |
| `error_recalculating_snapshots` | Mensaje de error |
| `recalculate_snapshots_tooltip` | Tooltip del botón |

## Archivos Modificados

1. **Frontend Component:**
   - [frontend/src/pages/AdminBalanceEvents.tsx](../frontend/src/pages/AdminBalanceEvents.tsx)

2. **Estilos:**
   - [frontend/src/styles/AdminBalanceEvents.css](../frontend/src/styles/AdminBalanceEvents.css)

3. **Traducciones:**
   - [frontend/src/i18n/locales/en.json](../frontend/src/i18n/locales/en.json)
   - [frontend/src/i18n/locales/es.json](../frontend/src/i18n/locales/es.json)
   - [frontend/src/i18n/locales/de.json](../frontend/src/i18n/locales/de.json)
   - [frontend/src/i18n/locales/ru.json](../frontend/src/i18n/locales/ru.json)
   - [frontend/src/i18n/locales/zh.json](../frontend/src/i18n/locales/zh.json)

## Flujo de Uso

1. **Admin crea un balance event** con fecha retroactiva
   - Ej: "26/11/2025 - Nerf a Undead"

2. **Admin hace click en "Recalculate Snapshots"**
   - Button se deshabilita y muestra "Recalculating..."
   - API recalcula todos los snapshots históricos

3. **Respuesta exitosa**
   - Muestra: "Historical snapshots recalculated successfully. Created 365 snapshots."
   - Ahora el balance event tiene datos históricos para comparación

4. **Seleccionar event en página de Estadísticas**
   - Muestra antes/después con cambios de winrate

## Integración Backend

El botón hace un POST a:
```
POST /api/statistics/history/recalculate-snapshots
```

Este endpoint (ya implementado en backend):
- Calcula todas las fechas desde el primer partido hasta hoy
- Crea snapshots para cada día
- Es seguro y no duplica datos
- Reporta cuántos snapshots se crearon

## UX Consideraciones

✅ **Button está junto a los eventos** - Ubicación lógica  
✅ **Tooltip explicativo** - Usuarios entienden qué hace  
✅ **Estado visual claro** - Muestra cuando está recalculando  
✅ **Feedback en tiempo real** - Muestra éxito/error inmediatamente  
✅ **Multiidioma** - Funciona en todos los idiomas soportados  

## Testing

Para probar la funcionalidad:

1. Crear un balance event con fecha pasada (ej: 26/11/2025)
2. Click en "Recalculate Snapshots"
3. Esperar respuesta (toma 10-30 segundos según cantidad de partidos)
4. Ir a Estadísticas
5. Seleccionar el balance event creado
6. Ver datos de impacto (antes/después)
