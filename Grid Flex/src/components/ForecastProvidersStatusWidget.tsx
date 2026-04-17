import React, { useEffect, useMemo, useState } from 'react';
import { CloudSun, Database, RefreshCw } from 'lucide-react';
import {
  fetchForecastProvidersStatus,
  type ForecastProvidersStatus } from
'../services/api';
import { Page } from './Sidebar';

const POLL_INTERVAL_MS = 12000;

type ProviderState = 'closed' | 'open' | 'half-open';

const stateTone = (state: ProviderState) => {
  if (state === 'closed') {
    return 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300';
  }
  if (state === 'half-open') {
    return 'bg-amber-500/15 border-amber-500/30 text-amber-300';
  }
  return 'bg-red-500/15 border-red-500/30 text-red-300';
};

const formatRemaining = (valueMs: number): string => {
  if (valueMs <= 0) return '0s';
  const seconds = Math.ceil(valueMs / 1000);
  return `${seconds}s`;
};

interface ForecastProvidersStatusWidgetProps {
  onNavigate: (page: Page) => void;
}

export function ForecastProvidersStatusWidget({ onNavigate }: ForecastProvidersStatusWidgetProps) {
  const [status, setStatus] = useState<ForecastProvidersStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const data = await fetchForecastProvidersStatus();
        if (!mounted) return;
        setStatus(data);
        setError(null);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : 'Failed to load provider status.');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void load();
    const intervalId = setInterval(() => {
      void load();
    }, POLL_INTERVAL_MS);

    return () => {
      mounted = false;
      clearInterval(intervalId);
    };
  }, []);

  const providers = useMemo(() => {
    if (!status) return [];
    return [
    {
      key: 'forecast.solar',
      state: status.providers.forecastSolar.state,
      configured: true,
      failures: status.providers.forecastSolar.failures,
      nextAttemptInMs: status.providers.forecastSolar.nextAttemptInMs
    },
    {
      key: 'openweathermap',
      state: status.providers.openWeather.state,
      configured: status.providers.openWeather.configured,
      failures: status.providers.openWeather.failures,
      nextAttemptInMs: status.providers.openWeather.nextAttemptInMs
    },
    {
      key: 'accuweather',
      state: status.providers.accuWeather.state,
      configured: status.providers.accuWeather.configured,
      failures: status.providers.accuWeather.failures,
      nextAttemptInMs: status.providers.accuWeather.nextAttemptInMs
    }];
  }, [status]);
  const cacheTtlMinutes = status ? Math.round((status.cache.ttlMs / 60000) * 10) / 10 : 0;

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-100">
          Forecast Provider Health
        </h3>
        <CloudSun className="w-4 h-4 text-cyan-400" />
      </div>

      {loading ?
      <div className="text-sm text-slate-400 flex items-center">
          <RefreshCw className="w-4 h-4 animate-spin mr-2" /> Loading health...
        </div> :

      error ?
      <p className="text-sm text-red-400">{error}</p> :

      <>
          <div className="space-y-2">
            {providers.map((provider) =>
            <div key={provider.key} className="flex items-center justify-between text-xs">
                <div>
                  <p className="text-slate-300 font-medium">{provider.key}</p>
                  <p className="text-slate-500">
                    {provider.configured ? `Failures: ${provider.failures}` : 'Not configured'}
                  </p>
                </div>
                <span className={`px-2 py-1 rounded border uppercase ${provider.configured ? stateTone(provider.state) : 'bg-slate-700/40 border-slate-600 text-slate-400'}`}>
                  {provider.configured ? provider.state : 'disabled'}
                </span>
              </div>
            )}
          </div>
          {providers.some((provider) => provider.nextAttemptInMs > 0) &&
          <p className="text-[11px] text-slate-500 mt-3">
              Next probe in {formatRemaining(Math.max(...providers.map((provider) => provider.nextAttemptInMs)))}
            </p>
          }
          <div className="mt-4 pt-3 border-t border-slate-700/70 text-xs text-slate-400 flex items-center justify-between">
            <span className="flex items-center">
              <Database className="w-3.5 h-3.5 mr-1.5" />
              Cache
            </span>
            <span>
              Redis {status?.cache.redisEnabled ? status.cache.redisConnected ? 'connected' : 'degraded' : 'off'} • {cacheTtlMinutes}m TTL
            </span>
          </div>
          <button
            onClick={() => onNavigate('provider-diagnostics')}
            className="w-full mt-3 py-2 text-xs text-cyan-300 hover:text-cyan-200 border border-cyan-500/20 hover:bg-cyan-500/10 rounded-lg transition-colors">
            Open Provider Diagnostics
          </button>
        </>
      }
    </div>);
}
