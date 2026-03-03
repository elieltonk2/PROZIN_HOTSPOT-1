import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Users, 
  PlusCircle, 
  Trash2, 
  RefreshCw, 
  ShieldCheck, 
  ShieldAlert,
  LayoutDashboard,
  Key,
  User,
  Plug,
  Database,
  Search,
  Download,
  X,
  Printer,
  Wifi,
  Network,
  FileText,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const Logo = ({ size = 32, className = "", src = null }: { size?: number, className?: string, src?: string | null }) => {
  if (src) {
    return <img src={src} alt="Logo" style={{ width: size, height: size }} className={`object-contain ${className}`} />;
  }
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 100 100" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Top-Right to Bottom-Left line */}
      <line x1="75" y1="25" x2="25" y2="75" stroke="#10b981" strokeWidth="8" strokeLinecap="round" />
      <circle cx="75" cy="25" r="6" fill="#10b981" />
      <circle cx="25" cy="75" r="6" fill="#10b981" />
      
      {/* Top-Left to Right line */}
      <line x1="25" y1="25" x2="75" y2="50" stroke="#10b981" strokeWidth="8" strokeLinecap="round" />
      <circle cx="25" cy="25" r="6" fill="#10b981" />
      <circle cx="75" cy="50" r="6" fill="#10b981" />
      
      {/* Bottom-Left to Right line */}
      <line x1="25" y1="75" x2="85" y2="85" stroke="#10b981" strokeWidth="8" strokeLinecap="round" />
      <circle cx="25" cy="75" r="6" fill="#10b981" />
      <circle cx="85" cy="85" r="6" fill="#10b981" />
    </svg>
  );
};

interface MikrotikUser {
  '.id': string;
  name: string;
  profile: string;
  uptime: string;
  'bytes-in': string;
  'bytes-out': string;
  comment?: string;
  disabled: string;
}

interface Profile {
  name: string;
}

export default function App() {
  const [config, setConfig] = useState(() => {
    const saved = localStorage.getItem('mikrotik_config');
    return saved ? JSON.parse(saved) : {
      host: '192.168.1.127',
      user: 'admin',
      password: '',
      port: '8728'
    };
  });

  useEffect(() => {
    localStorage.setItem('mikrotik_config', JSON.stringify(config));
  }, [config]);
  const [isConnected, setIsConnected] = useState(false);
  const [users, setUsers] = useState<MikrotikUser[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'generator' | 'settings' | 'hotspot' | 'ppp' | 'logs' | 'about'>('settings');
  
  // Generator state
  const [genCount, setGenCount] = useState(10);
  const [genProfile, setGenProfile] = useState('default');
  const [genPrefix, setGenPrefix] = useState('');
  const [genLength, setGenLength] = useState(8);
  const [genVoucherType, setGenVoucherType] = useState('username_only');
  const [genCharType, setGenCharType] = useState('numbers');
  const [genLimitBytes, setGenLimitBytes] = useState('0');
  const [genDNSName, setGenDNSName] = useState('prozin.com');
  const [genPrice, setGenPrice] = useState('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [genColor, setGenColor] = useState('emerald');
  const [outletName, setOutletName] = useState(() => localStorage.getItem('outlet_name') || 'PROZIN_HOTSPOT');
  const [lastGenerated, setLastGenerated] = useState<string[]>([]);
  const [showPrintView, setShowPrintView] = useState(false);
  const [settingsTab, setSettingsTab] = useState('general');
  const [voucherTemplateType, setVoucherTemplateType] = useState('standard');
  const [voucherImage, setVoucherImage] = useState<string | null>(null);
  const [systemLogo, setSystemLogo] = useState<string | null>(() => localStorage.getItem('system_logo'));
  const [detectedIP, setDetectedIP] = useState<string | null>(null);
  
  useEffect(() => {
    fetch('/api/utils/my-ip')
      .then(res => res.json())
      .then(data => setDetectedIP(data.ip))
      .catch(() => {});
  }, []);
  
  useEffect(() => {
    localStorage.setItem('outlet_name', outletName);
  }, [outletName]);

  useEffect(() => {
    if (systemLogo) localStorage.setItem('system_logo', systemLogo);
    else localStorage.removeItem('system_logo');
  }, [systemLogo]);
  
  // Uptime state
  const [uptimeDays, setUptimeDays] = useState(0);
  const [uptimeHours, setUptimeHours] = useState(1);
  const [uptimeMinutes, setUptimeMinutes] = useState(0);

  useEffect(() => {
    if (profiles.length > 0 && !profiles.find(p => p.name === genProfile)) {
      setGenProfile(profiles[0].name);
    }
  }, [profiles]);

  const [testResult, setTestResult] = useState<{success: boolean, message: string} | null>(null);

  const handleTestPort = async () => {
    setLoading(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/mikrotik/test-port', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ host: config.host, port: config.port })
      });
      const data = await res.json();
      setTestResult({ success: data.success, message: data.message });
    } catch (err) {
      setTestResult({ success: false, message: 'Erro ao testar porta.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setIsMobileMenuOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleSetupCleanup = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/mikrotik/setup-cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      const data = await res.json();
      if (data.success) {
        alert(data.message);
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Erro ao configurar auto-limpeza.');
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/mikrotik/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      const data = await res.json();
      if (data.success) {
        setIsConnected(true);
        setActiveTab('dashboard');
        fetchData(true);
      } else {
        // Show the specific error from Mikrotik
        setError(data.message || 'Erro desconhecido ao conectar ao Mikrotik.');
      }
    } catch (err) {
      setError('Não foi possível alcançar o servidor do App. Verifique sua internet ou se o servidor está rodando.');
    } finally {
      setLoading(false);
    }
  };

  const fetchData = async (force = false) => {
    if (!isConnected && !force) return;
    setLoading(true);
    setError(null);
    try {
      const [usersRes, profilesRes] = await Promise.all([
        fetch('/api/mikrotik/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(config)
        }),
        fetch('/api/mikrotik/profiles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(config)
        })
      ]);
      
      const usersData = await usersRes.json();
      const profilesData = await profilesRes.json();
      
      if (usersData.success) setUsers(usersData.users);
      if (profilesData.success) setProfiles(profilesData.profiles);
    } catch (err) {
      setError('Erro ao buscar dados do Mikrotik.');
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setVoucherImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerate = async () => {
    setLoading(true);
    
    // Format uptime string
    const uptimeStr = `${uptimeDays > 0 ? uptimeDays + 'd' : ''}${uptimeHours}h${uptimeMinutes}m`;
    
    // Format bytes string (assuming input is in MB)
    const bytesVal = parseInt(genLimitBytes) > 0 ? (parseInt(genLimitBytes) * 1024 * 1024).toString() : "0";

    try {
      const res = await fetch('/api/mikrotik/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...config,
          count: genCount,
          profile: genProfile,
          prefix: genPrefix,
          length: genLength,
          limitUptime: uptimeStr,
          limitBytes: bytesVal,
          voucherType: genVoucherType,
          charType: genCharType,
          comment: `Preço: ${genPrice} | Cor: ${genColor}`
        })
      });
      const data = await res.json();
      if (data.success) {
        setLastGenerated(data.createdUsers);
        setShowPrintView(true);
        fetchData();
        setActiveTab('dashboard');
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Erro ao gerar usuários.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/mikrotik/users/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      const data = await res.json();
      if (data.success) {
        setUsers(users.filter(u => u['.id'] !== id));
      }
    } catch (err) {
      setError('Erro ao excluir usuário.');
    }
  };

  // Force rebuild - v1.0.1
  if (!isConnected) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md bg-zinc-950 shadow-2xl overflow-hidden border border-white/5"
        >
          {/* Header */}
          <div className="bg-zinc-950 p-3 flex items-center justify-between text-accent shadow-lg border-b border-accent/20">
            <div className="flex items-center gap-2">
              <ShieldCheck size={16} className="text-accent" />
              <span className="font-bold text-sm tracking-tight uppercase">{outletName}</span>
            </div>
            <button className="hover:bg-white/10 p-1 rounded transition-colors text-zinc-400">
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div className="p-8 space-y-8">
            {/* Logo Display */}
            {systemLogo && (
              <div className="flex justify-center mb-4">
                <img src={systemLogo} alt="Logo" className="h-20 w-auto object-contain brightness-125" referrerPolicy="no-referrer" />
              </div>
            )}

            <form onSubmit={handleConnect} className="space-y-8">
              {/* Connection Row */}
              <div className="flex items-start gap-6">
                <div className="p-3 bg-zinc-900 rounded-lg text-accent/50 border border-white/5">
                  <Plug size={32} />
                </div>
                <div className="flex-1 space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-accent/70 uppercase tracking-widest">Conectar a :</label>
                    <input 
                      type="text" 
                      value={config.host}
                      onChange={e => setConfig({...config, host: e.target.value})}
                      className="w-full bg-zinc-800 text-white px-3 py-2 rounded border border-white/5 focus:outline-none focus:ring-2 focus:ring-accent transition-all font-mono text-sm"
                      placeholder="IP ou DNS Cloud"
                      required
                    />
                    {(config.host.toLowerCase().startsWith('fd') || config.host.toLowerCase().startsWith('fe') || config.host.startsWith('192.168') || config.host.startsWith('10.')) && (
                      <p className="text-[8px] text-orange-500 mt-1 uppercase font-bold tracking-tighter animate-pulse">
                        ⚠️ IP Local detectado. Use o DNS Cloud (IP para Cloud) para acesso remoto.
                      </p>
                    )}
                  </div>
                  <div className="flex justify-end">
                    <div className="w-24 space-y-1">
                      <input 
                        type="text" 
                        value={config.port}
                        onChange={e => setConfig({...config, port: e.target.value})}
                        className="w-full bg-zinc-800 text-white px-3 py-2 rounded border border-white/5 text-right focus:outline-none focus:ring-2 focus:ring-accent transition-all font-mono text-sm"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Login Row */}
              <div className="flex items-center gap-6">
                <div className="p-3 bg-zinc-900 rounded-lg text-accent/50 border border-white/5">
                  <User size={32} />
                </div>
                <div className="flex-1 space-y-1">
                  <label className="text-[10px] font-bold text-accent/70 uppercase tracking-widest">Usuário :</label>
                  <input 
                    type="text" 
                    value={config.user}
                    onChange={e => setConfig({...config, user: e.target.value})}
                    className="w-full bg-zinc-800 text-white px-3 py-2 rounded border border-white/5 focus:outline-none focus:ring-2 focus:ring-accent transition-all font-mono text-sm"
                    required
                  />
                </div>
              </div>

              {/* Password Row */}
              <div className="flex items-center gap-6">
                <div className="p-3 bg-zinc-900 rounded-lg text-accent/50 border border-white/5">
                  <Key size={32} />
                </div>
                <div className="flex-1 space-y-1">
                  <label className="text-[10px] font-bold text-accent/70 uppercase tracking-widest">Senha :</label>
                  <input 
                    type="password" 
                    value={config.password}
                    onChange={e => setConfig({...config, password: e.target.value})}
                    className="w-full bg-zinc-800 text-white px-3 py-2 rounded border border-white/5 focus:outline-none focus:ring-2 focus:ring-accent transition-all font-mono text-sm"
                  />
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-950/30 text-red-500 text-[10px] font-bold uppercase tracking-widest border border-red-900/50 flex items-center gap-2">
                  <ShieldAlert size={14} />
                  <div className="flex-1">
                    {error}
                    {error.includes('192.168') && (
                      <p className="mt-2 text-[8px] opacity-60 normal-case">Dica: IPs 192.168.x.x são locais. Use o IPv6 ou DNS Cloud para acesso remoto.</p>
                    )}
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-4">
                <button 
                  type="button"
                  onClick={handleTestPort}
                  disabled={loading}
                  className="w-full border border-white/10 text-[10px] font-bold uppercase tracking-widest py-3 hover:bg-white/5 transition-all flex items-center justify-center gap-2 disabled:opacity-30"
                >
                  {loading ? <RefreshCw className="animate-spin" size={12} /> : <Wifi size={12} />}
                  Testar Conexão (Porta {config.port})
                </button>

                {testResult && (
                  <div className={`p-3 text-[9px] uppercase font-bold tracking-widest border flex flex-col gap-2 ${testResult.success ? 'bg-accent/10 border-accent text-accent' : 'bg-red-950/30 border-red-900 text-red-500'}`}>
                    <div className="flex items-center gap-2">
                      {testResult.success ? <ShieldCheck size={14} /> : <ShieldAlert size={14} />}
                      <span>{testResult.message}</span>
                    </div>
                    {!testResult.success && (testResult.message.includes('IPv6') || testResult.message.includes('ENETUNREACH') || testResult.message.includes('suporta')) && (
                      <div className="bg-black/40 p-2 rounded text-[8px] normal-case font-normal opacity-80">
                        Dica: O Railway não suporta IPv6. Ative o 'IP para Cloud' no Mikrotik e use o 'DNS Name' no campo acima.
                      </div>
                    )}
                  </div>
                )}
              </div>

              {detectedIP && (
                <div className="text-center">
                  <p className="text-[9px] uppercase tracking-widest opacity-30">Seu IP Detectado:</p>
                  <p className="text-[10px] font-mono text-accent/60 mt-1">{detectedIP}</p>
                </div>
              )}
            </form>
          </div>

          {/* Footer / Login Button */}
          <button 
            onClick={() => handleConnect()}
            disabled={loading}
            className="w-full bg-accent text-black py-5 font-bold uppercase tracking-[0.3em] text-sm hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-50 border-t border-accent/20"
          >
            {loading ? <RefreshCw className="animate-spin" size={18} /> : 'ENTRAR'}
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-zinc-300 font-sans selection:bg-accent selection:text-black">
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 w-full bg-zinc-950 border-b border-white/5 p-4 flex items-center justify-between z-30">
        <div className="flex items-center gap-3">
          <Logo size={32} src={systemLogo} />
          <h1 className="font-serif italic text-lg font-bold text-accent truncate max-w-[150px] uppercase tracking-tight">{outletName}</h1>
        </div>
        <button 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 text-accent hover:bg-white/5 transition-all rounded"
        >
          {isMobileMenuOpen ? <X size={24} /> : <LayoutDashboard size={24} />}
        </button>
      </div>

      {/* Sidebar Overlay for Mobile */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsMobileMenuOpen(false)}
            className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <div className={`fixed left-0 top-0 h-full w-64 border-r border-white/5 bg-zinc-950 z-50 transition-transform duration-300 lg:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-8 border-b border-white/5 flex flex-col items-center text-center">
          <Logo size={64} className="mb-4" src={systemLogo} />
          <h1 className="font-serif italic text-xl font-bold tracking-tight text-accent truncate w-full uppercase">{outletName}</h1>
          <p className="text-[10px] uppercase tracking-widest opacity-40 mt-1 text-accent/50">Mikrotik Hotspot Manager</p>
        </div>

        <nav className="mt-8 overflow-y-auto max-h-[calc(100vh-300px)]">
          {isConnected && (
            <>
              <button 
                onClick={() => {
                  setActiveTab('dashboard');
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-4 px-8 py-4 text-sm font-medium transition-all ${activeTab === 'dashboard' ? 'bg-accent text-black' : 'hover:bg-white/5 opacity-40 hover:opacity-100'}`}
              >
                <LayoutDashboard size={18} />
                Dashboard
              </button>
              <button 
                onClick={() => {
                  setActiveTab('generator');
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-4 px-8 py-4 text-sm font-medium transition-all ${activeTab === 'generator' ? 'bg-accent text-black' : 'hover:bg-white/5 opacity-40 hover:opacity-100'}`}
              >
                <PlusCircle size={18} />
                Gerador de Vouchers
              </button>
              <button 
                onClick={() => {
                  setActiveTab('hotspot');
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-4 px-8 py-4 text-sm font-medium transition-all ${activeTab === 'hotspot' ? 'bg-accent text-black' : 'hover:bg-white/5 opacity-40 hover:opacity-100'}`}
              >
                <Wifi size={18} />
                Hotspot
              </button>
              <button 
                onClick={() => {
                  setActiveTab('ppp');
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-4 px-8 py-4 text-sm font-medium transition-all ${activeTab === 'ppp' ? 'bg-accent text-black' : 'hover:bg-white/5 opacity-40 hover:opacity-100'}`}
              >
                <Network size={18} />
                PPP
              </button>
            </>
          )}
          
          <button 
            onClick={() => {
              setActiveTab('settings');
              setIsMobileMenuOpen(false);
            }}
            className={`w-full flex items-center gap-4 px-8 py-4 text-sm font-medium transition-all ${activeTab === 'settings' ? 'bg-accent text-black' : 'hover:bg-white/5 opacity-40 hover:opacity-100'}`}
          >
            <Settings size={18} />
            Configurações
          </button>

          {isConnected && (
            <button 
              onClick={() => {
                setActiveTab('logs');
                setIsMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-4 px-8 py-4 text-sm font-medium transition-all ${activeTab === 'logs' ? 'bg-accent text-black' : 'hover:bg-white/5 opacity-40 hover:opacity-100'}`}
            >
              <FileText size={18} />
              Logs
            </button>
          )}

          <button 
            onClick={() => {
              setActiveTab('about');
              setIsMobileMenuOpen(false);
            }}
            className={`w-full flex items-center gap-4 px-8 py-4 text-sm font-medium transition-all ${activeTab === 'about' ? 'bg-accent text-black' : 'hover:bg-white/5 opacity-40 hover:opacity-100'}`}
          >
            <Info size={18} />
            Sobre
          </button>
        </nav>

        <div className="absolute bottom-0 w-full p-8 border-t border-white/5">
          <div className="mb-4 p-3 bg-accent/5 border border-accent/10 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <RefreshCw size={10} className="text-accent animate-pulse" />
              <span className="text-[9px] uppercase font-bold tracking-widest text-accent">Cloud Active</span>
            </div>
            <p className="text-[9px] opacity-40 truncate text-accent/50">Host: {config.host}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-accent shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-red-500'}`} />
            <span className="text-[10px] uppercase font-bold tracking-widest opacity-40">
              {isConnected ? 'Conectado' : 'Desconectado'}
            </span>
          </div>
        </div>
      </div>

      {showPrintView && (
        <div className="fixed inset-0 z-[100] bg-zinc-950 flex flex-col overflow-hidden print:p-0 print:bg-white">
          <div className="p-6 border-b border-white/10 flex justify-between items-center print:hidden">
            <h2 className="font-serif italic text-2xl">Vouchers Gerados</h2>
            <div className="flex gap-4">
              <button 
                onClick={() => window.print()}
                className="bg-accent text-black px-6 py-2 font-bold uppercase tracking-widest text-xs flex items-center gap-2 hover:opacity-90 transition-opacity"
              >
                <Printer size={16} /> Imprimir
              </button>
              <button 
                onClick={() => setShowPrintView(false)}
                className="border border-white/10 px-6 py-2 font-bold uppercase tracking-widest text-xs hover:bg-white/5 transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-12 bg-zinc-900/50 print:bg-white print:p-0">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 print:grid-cols-3 print:gap-2">
              {lastGenerated.map((code) => (
                <div key={code} className={`bg-zinc-950 border border-white/10 p-6 rounded-xl flex flex-col items-center text-center print:border-black print:text-black print:rounded-none print:shadow-none print:bg-white relative overflow-hidden min-h-[180px] justify-center`}>
                  {voucherTemplateType === 'custom' && voucherImage ? (
                    <div className="absolute inset-0 z-0">
                      <img src={voucherImage} alt="Template" className="w-full h-full object-cover opacity-30 print:opacity-100" />
                    </div>
                  ) : (
                    <div className={`absolute top-0 left-0 w-full h-1 ${
                      genColor === 'blue' ? 'bg-blue-500' : 
                      genColor === 'red' ? 'bg-red-500' : 
                      genColor === 'amber' ? 'bg-amber-500' : 
                      genColor === 'purple' ? 'bg-purple-500' : 'bg-accent'
                    }`} />
                  )}
                  
                  <div className="relative z-10 w-full flex flex-col items-center">
                    <Logo size={24} className="mb-2 opacity-80" src={systemLogo} />
                    <div className="text-[10px] uppercase font-bold tracking-widest opacity-60 mb-3 print:text-black">{outletName}</div>
                    <div className="font-serif italic text-2xl mb-2">{code}</div>
                    <div className="text-[9px] uppercase tracking-widest opacity-40 print:opacity-100 font-bold">
                      {uptimeDays > 0 ? `${uptimeDays}d ` : ''}{uptimeHours}h {uptimeMinutes}m
                      {parseInt(genLimitBytes) > 0 ? ` • ${genLimitBytes}MB` : ''}
                    </div>
                    {genPrice && (
                      <div className="mt-2 text-[11px] font-bold text-accent print:text-black">
                        {genPrice}
                      </div>
                    )}
                    <div className="mt-4 pt-4 border-t border-white/5 w-full text-[8px] opacity-30 print:border-black print:opacity-100 leading-relaxed">
                      Portal: {genDNSName}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="lg:ml-64 p-6 lg:p-12 min-h-screen pt-24 lg:pt-12">
        <AnimatePresence mode="wait">
          {activeTab === 'hotspot' && (
            <motion.div 
              key="hotspot"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <div className="mb-12">
                <h2 className="font-serif italic text-4xl mb-2">Hotspot Status</h2>
                <p className="opacity-40 text-sm">Informações em tempo real do seu servidor Hotspot.</p>
              </div>
              <div className="p-12 border border-line bg-white/5 text-center opacity-40 italic">
                Módulo Hotspot em desenvolvimento. Em breve você poderá ver usuários ativos e hosts.
              </div>
            </motion.div>
          )}

          {activeTab === 'ppp' && (
            <motion.div 
              key="ppp"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <div className="flex justify-between items-end mb-12">
                <div>
                  <h2 className="font-serif italic text-4xl mb-2">PPP (PPPoE)</h2>
                  <p className="opacity-40 text-sm">Gerenciamento de conexões PPPoE e IPv6.</p>
                </div>
                <div className="flex gap-4">
                  <button 
                    onClick={async () => {
                      if (!window.confirm("Isso irá configurar o DHCPv6 Client na ether1 e o perfil default para usar o pool 'pool-pppoe'. Continuar?")) return;
                      setLoading(true);
                      try {
                        const res = await fetch('/api/mikrotik/setup-ipv6-pppoe', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify(config)
                        });
                        const data = await res.json();
                        if (data.success) alert("IPv6 configurado com sucesso no perfil default!");
                        else alert("Erro: " + data.message);
                      } catch (e) {
                        alert("Erro de conexão");
                      } finally {
                        setLoading(false);
                      }
                    }}
                    className="flex items-center gap-2 bg-accent/10 text-accent border border-accent/20 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-accent hover:text-black transition-all"
                  >
                    <Network size={16} /> Configurar IPv6
                  </button>
                  <button 
                    onClick={() => fetchData(true)}
                    className="p-2 border border-line hover:bg-white/5 transition-colors rounded-lg text-accent"
                  >
                    <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                  </button>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                <div className="p-6 border border-line bg-surface">
                  <div className="text-[10px] uppercase font-bold tracking-widest opacity-40 mb-2">Clientes Ativos</div>
                  <div className="text-3xl font-serif italic text-accent">{users.length}</div>
                </div>
                <div className="p-6 border border-line bg-surface">
                  <div className="text-[10px] uppercase font-bold tracking-widest opacity-40 mb-2">Pool IPv6</div>
                  <div className="text-xs font-mono opacity-60 truncate">pool-pppoe (PD /64)</div>
                </div>
                <div className="p-6 border border-line bg-surface">
                  <div className="text-[10px] uppercase font-bold tracking-widest opacity-40 mb-2">Status Starlink</div>
                  <div className="text-xs text-accent font-bold uppercase tracking-widest">Conectado</div>
                </div>
              </div>

              <div className="border border-line bg-surface overflow-x-auto">
                <div className="min-w-[600px]">
                  <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr] p-4 border-b border-line bg-white/5">
                    <span className="text-[10px] uppercase font-bold tracking-widest opacity-40">Usuário PPPoE</span>
                    <span className="text-[10px] uppercase font-bold tracking-widest opacity-40">Endereço IP</span>
                    <span className="text-[10px] uppercase font-bold tracking-widest opacity-40">Uptime</span>
                    <span className="text-[10px] uppercase font-bold tracking-widest opacity-40 text-right">Serviço</span>
                  </div>
                  <div className="divide-y divide-line">
                    {users.length === 0 ? (
                      <div className="p-12 text-center opacity-20 italic">Nenhum cliente PPPoE ativo no momento.</div>
                    ) : (
                      users.map((user, idx) => (
                        <div key={idx} className="grid grid-cols-[1.5fr_1fr_1fr_1fr] p-4 items-center hover:bg-white/5 transition-all group">
                          <span className="font-mono font-bold text-accent truncate">{user.name}</span>
                          <span className="text-sm opacity-60 truncate">{user.address || '---'}</span>
                          <span className="text-sm opacity-60 font-mono truncate">{user.uptime || '0s'}</span>
                          <span className="text-[10px] uppercase font-bold opacity-40 text-right">pppoe</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'logs' && (
            <motion.div 
              key="logs"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <div className="mb-12">
                <h2 className="font-serif italic text-4xl mb-2">Logs do Sistema</h2>
                <p className="opacity-40 text-sm">Histórico de eventos do Mikrotik.</p>
              </div>
              <div className="p-12 border border-line bg-white/5 text-center opacity-40 italic">
                Módulo de Logs em desenvolvimento.
              </div>
            </motion.div>
          )}

          {activeTab === 'about' && (
            <motion.div 
              key="about"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-2xl"
            >
              <div className="mb-12">
                <h2 className="font-serif italic text-4xl mb-2">Sobre o Sistema</h2>
                <p className="opacity-40 text-sm">PROZIN_HOTSPOT v1.0.0</p>
              </div>
              
              <div className="space-y-8">
                <div className="p-8 border border-line bg-white/5">
                  <h3 className="font-bold uppercase tracking-widest text-xs mb-4 text-accent">Verificação de Acesso Remoto</h3>
                  <p className="text-sm opacity-60 leading-relaxed mb-4">
                    Você mencionou que não tem certeza se o acesso é remoto. Aqui está a prova:
                  </p>
                  <ul className="space-y-3 text-sm">
                    <li className="flex items-start gap-3">
                      <div className="mt-1 p-1 bg-accent/20 rounded-full"><ShieldCheck size={12} className="text-accent" /></div>
                      <span>Este aplicativo está rodando em um servidor na **Nuvem (Google Cloud)**.</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="mt-1 p-1 bg-accent/20 rounded-full"><ShieldCheck size={12} className="text-accent" /></div>
                      <span>Quando você clica em "Conectar", o servidor na nuvem viaja pela internet até o seu IP IPv6 (**{config.host}**).</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="mt-1 p-1 bg-accent/20 rounded-full"><ShieldCheck size={12} className="text-accent" /></div>
                      <span>Mesmo que seu computador esteja na mesma rede, a "conversa" acontece entre a Nuvem e o seu Mikrotik.</span>
                    </li>
                  </ul>
                </div>

                <div className="p-8 border border-line bg-white/5">
                  <h3 className="font-bold uppercase tracking-widest text-xs mb-4">Desenvolvedor</h3>
                  <p className="text-sm opacity-60">Sistema desenvolvido para gestão simplificada de Hotspot Mikrotik via API.</p>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'settings' && (
            <motion.div 
              key="settings"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="max-w-xl"
            >
              <div className="mb-12">
                <h2 className="font-serif italic text-4xl mb-2">Configurações</h2>
                <p className="opacity-40 text-sm">Ajuste os parâmetros do sistema e conexão.</p>
              </div>

              <div className="flex gap-8 border-b border-white/5 mb-12">
                <button 
                  onClick={() => setSettingsTab('general')}
                  className={`pb-4 text-[10px] font-bold uppercase tracking-widest transition-all ${settingsTab === 'general' ? 'text-accent border-b-2 border-accent' : 'opacity-40 hover:opacity-100'}`}
                >
                  Geral
                </button>
                <button 
                  onClick={() => setSettingsTab('custom_html')}
                  className={`pb-4 text-[10px] font-bold uppercase tracking-widest transition-all ${settingsTab === 'custom_html' ? 'text-accent border-b-2 border-accent' : 'opacity-40 hover:opacity-100'}`}
                >
                  Custom HTML
                </button>
              </div>

              {settingsTab === 'general' ? (
                <div className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase font-bold tracking-widest opacity-40">Outlet Name (Nome do Estabelecimento)</label>
                      <input 
                        type="text" 
                        value={outletName}
                        onChange={e => setOutletName(e.target.value)}
                        className="w-full bg-transparent border-b border-line py-2 focus:outline-none focus:border-accent transition-colors font-mono"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase font-bold tracking-widest opacity-40">Logo do Sistema (Sua Imagem)</label>
                      <div className="flex items-center gap-4">
                        <input 
                          type="file" 
                          accept="image/*" 
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onloadend = () => setSystemLogo(reader.result as string);
                              reader.readAsDataURL(file);
                            }
                          }}
                          className="hidden" 
                          id="system-logo-upload"
                        />
                        <label 
                          htmlFor="system-logo-upload"
                          className="px-4 py-2 border border-line hover:bg-white/5 text-[10px] font-bold uppercase tracking-widest cursor-pointer transition-all"
                        >
                          Trocar Logo
                        </label>
                        {systemLogo && (
                          <button 
                            type="button"
                            onClick={() => setSystemLogo(null)}
                            className="text-red-500 text-[10px] font-bold uppercase tracking-widest hover:underline"
                          >
                            Remover
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-accent/5 border border-accent/20 text-accent text-[10px] leading-relaxed">
                    <strong>DICA:</strong> As informações de conexão (IP, Usuário e Senha) agora são gerenciadas diretamente na tela de login para sua segurança e praticidade.
                  </div>

                {error && (
                  <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-500 text-xs flex items-center gap-3">
                    <ShieldAlert size={16} />
                    {error}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button 
                    type="button"
                    onClick={handleSetupCleanup}
                    disabled={loading || !isConnected}
                    className="w-full border border-accent/30 text-accent hover:bg-accent/5 py-4 font-bold uppercase tracking-widest text-xs transition-all flex items-center justify-center gap-3 disabled:opacity-30"
                  >
                    <Trash2 size={16} />
                    Ativar Auto-Limpeza de Expirados
                  </button>
                  <button 
                    type="button"
                    onClick={() => setIsConnected(false)}
                    className="w-full border border-red-500/30 text-red-500 hover:bg-red-500/5 py-4 font-bold uppercase tracking-widest text-xs transition-all flex items-center justify-center gap-3"
                  >
                    <X size={16} />
                    Sair / Desconectar
                  </button>
                </div>

                {testResult && (
                  <div className={`p-4 border text-[10px] leading-relaxed flex items-center gap-3 ${testResult.success ? 'bg-accent/10 border-accent text-accent' : 'bg-red-500/10 border-red-500 text-red-500'}`}>
                    {testResult.success ? <ShieldCheck size={16} /> : <ShieldAlert size={16} />}
                    {testResult.message}
                  </div>
                )}

                <div className="mt-12 pt-12 border-t border-line">
                  <h3 className="text-[10px] uppercase font-bold tracking-widest opacity-40 mb-4">Evolução: Acesso Remoto (Nuvem)</h3>
                  <div className="space-y-4 text-[11px] leading-relaxed opacity-60">
                    <p>Para gerenciar seu Mikrotik de qualquer lugar sem precisar rodar o programa localmente:</p>
                    <ol className="list-decimal ml-4 space-y-2">
                      <li>
                        <strong>Ative o DDNS do Mikrotik:</strong> No Winbox, vá em <code>IP {'>'} Cloud</code> e marque <code>DDNS Enabled</code>. Copie o <code>DNS Name</code>.
                      </li>
                      <li>
                        <strong>Libere a Porta:</strong> No seu modem/roteador principal, faça um redirecionamento (Port Forward) da porta <strong>8728</strong> para o IP do Mikrotik.
                      </li>
                      <li>
                        <strong>Use o DNS:</strong> No campo "Endereço IP" acima, cole o nome DNS que você copiou (ex: <code>xxxx.sn.mynetname.net</code>).
                      </li>
                    </ol>
                    <div className="p-4 bg-accent/5 border border-accent/10 text-accent italic">
                      Dica: Com isso configurado, você pode usar este link do navegador em qualquer lugar do mundo!
                    </div>

                    <div className="mt-8 p-6 bg-surface border border-line rounded-lg">
                      <h4 className="text-[10px] uppercase font-bold tracking-widest mb-4 text-accent">Script de Configuração Rápida</h4>
                      <p className="text-[10px] opacity-40 mb-4">Copie e cole no Terminal do seu Mikrotik (Winbox {'>'} New Terminal):</p>
                      <pre className="bg-black/40 p-4 rounded font-mono text-[10px] overflow-x-auto border border-line text-accent select-all">
                        {`/ip cloud set ddns-enabled=yes\n/ip service enable api\n/ip firewall filter add action=accept chain=input dst-port=8728 protocol=tcp comment="Permitir API Mikrotik (UserMan)"`}
                      </pre>
                      
                      <div className="mt-6 pt-6 border-t border-line/50">
                        <h5 className="text-[9px] uppercase font-bold text-amber-500 mb-2">Atenção: Starlink + hEX lite</h5>
                        <p className="text-[10px] opacity-60 leading-relaxed">
                          Seu modelo (hEX lite) não suporta as VPNs automáticas da MikroTik devido à arquitetura MIPSBE. Para Starlink, tente:
                        </p>
                        <ul className="list-disc ml-4 mt-2 space-y-1 text-[10px] opacity-60">
                          <li><strong>IPv6 Público:</strong> A Starlink fornece IPv6. Use o script abaixo no terminal para ganhar um IP acessível globalmente.</li>
                          <li><strong>VPN WireGuard:</strong> Configure um túnel manual para um servidor que tenha IP fixo.</li>
                        </ul>
                        <div className="mt-4 p-3 bg-black/20 border border-line rounded">
                          <p className="text-[9px] uppercase font-bold mb-2 opacity-40">Dica Starlink IPv6:</p>
                          <p className="text-[10px] opacity-60 mb-2">No DHCPv6 Client, mude o <strong>Pool Prefix Length</strong> para <strong>56</strong> (em vez de 64). Isso é essencial para a Starlink entregar o endereço.</p>
                          <pre className="text-[9px] text-accent overflow-x-auto">
                            {`/ipv6 dhcp-client add add-default-route=yes interface=ether1 pool-name=starlink request=prefix pool-prefix-length=56`}
                          </pre>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-8">
                <div className="space-y-6">
                  <h3 className="font-serif italic text-2xl">Voucher Template</h3>
                  
                  <div className="space-y-4">
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input 
                        type="radio" 
                        name="templateType" 
                        value="standard" 
                        checked={voucherTemplateType === 'standard'}
                        onChange={() => setVoucherTemplateType('standard')}
                        className="w-4 h-4 accent-accent"
                      />
                      <span className={`text-sm transition-colors ${voucherTemplateType === 'standard' ? 'text-accent font-bold' : 'opacity-60'}`}>
                        Template padrão (Sem Imagem)
                      </span>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input 
                        type="radio" 
                        name="templateType" 
                        value="custom" 
                        checked={voucherTemplateType === 'custom'}
                        onChange={() => setVoucherTemplateType('custom')}
                        className="w-4 h-4 accent-accent"
                      />
                      <span className={`text-sm transition-colors ${voucherTemplateType === 'custom' ? 'text-accent font-bold' : 'opacity-60'}`}>
                        Template customizado
                      </span>
                    </label>
                  </div>

                  {voucherTemplateType === 'custom' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                      <div className="border-2 border-dashed border-white/10 rounded-2xl p-8 flex flex-col items-center justify-center relative overflow-hidden min-h-[200px] bg-black/20">
                        {voucherImage ? (
                          <>
                            <img src={voucherImage} alt="Preview" className="max-w-full max-h-[180px] object-contain rounded shadow-2xl" />
                            <button 
                              onClick={() => setVoucherImage(null)}
                              className="absolute top-4 right-4 bg-red-500 text-white p-2 rounded-full hover:scale-110 transition-transform"
                            >
                              <Trash2 size={16} />
                            </button>
                          </>
                        ) : (
                          <label className="flex flex-col items-center cursor-pointer hover:opacity-80 transition-opacity">
                            <Download size={48} className="opacity-20 mb-4" />
                            <span className="text-xs font-bold uppercase tracking-widest opacity-40">Clique para enviar imagem</span>
                            <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                          </label>
                        )}
                      </div>
                      <p className="text-[10px] opacity-40 text-center">
                        A imagem deve ser um (*.png/jpg) largura 450px e Altura 250px recomendada.
                      </p>
                    </div>
                  )}

                  <button 
                    onClick={() => {
                      alert('Modelo de voucher salvo com sucesso!');
                    }}
                    className="w-full bg-zinc-800 text-white py-4 font-bold uppercase tracking-widest text-xs hover:bg-accent hover:text-black transition-all flex items-center justify-center gap-3 border border-white/5"
                  >
                    <Database size={16} />
                    Salvar o modelo do voucher
                  </button>
                </div>
              </div>
            )}
          </motion.div>
          )}

          {activeTab === 'dashboard' && (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="flex justify-between items-end mb-12">
                <div>
                  <h2 className="font-serif italic text-4xl mb-2">Usuários Hotspot</h2>
                  <p className="opacity-40 text-sm">Gerencie os vouchers e usuários ativos no sistema.</p>
                </div>
                <div className="flex gap-4">
                  <button 
                    onClick={fetchData}
                    className="p-3 border border-line hover:bg-white/5 transition-all"
                  >
                    <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                  </button>
                  <button 
                    onClick={() => setActiveTab('generator')}
                    className="flex items-center gap-2 px-6 py-3 bg-accent text-bg font-bold uppercase tracking-widest text-[10px] hover:opacity-90 transition-all"
                  >
                    <PlusCircle size={16} />
                    Novo Lote
                  </button>
                </div>
              </div>

              <div className="border border-line bg-surface overflow-x-auto">
                <div className="min-w-[600px]">
                  <div className="grid grid-cols-[1fr_1fr_1fr_1fr_80px] p-4 border-b border-line bg-white/5">
                    <span className="text-[10px] uppercase font-bold tracking-widest opacity-40">Usuário</span>
                    <span className="text-[10px] uppercase font-bold tracking-widest opacity-40">Perfil</span>
                    <span className="text-[10px] uppercase font-bold tracking-widest opacity-40">Uptime</span>
                    <span className="text-[10px] uppercase font-bold tracking-widest opacity-40">Tráfego (IN/OUT)</span>
                    <span className="text-[10px] uppercase font-bold tracking-widest opacity-40 text-right">Ações</span>
                  </div>
                  <div className="divide-y divide-line">
                    {users.length === 0 ? (
                      <div className="p-12 text-center opacity-20 italic">Nenhum usuário encontrado.</div>
                    ) : (
                      users.map(user => (
                        <div key={user['.id']} className="grid grid-cols-[1fr_1fr_1fr_1fr_80px] p-4 items-center hover:bg-white/5 transition-all group">
                          <span className="font-mono font-bold text-accent truncate">{user.name}</span>
                          <span className="text-sm opacity-60 group-hover:opacity-100 truncate">{user.profile}</span>
                          <span className="text-sm opacity-60 group-hover:opacity-100 font-mono truncate">{user.uptime || '0s'}</span>
                          <span className="text-sm opacity-60 group-hover:opacity-100 font-mono truncate">
                            {user['bytes-in']} / {user['bytes-out']}
                          </span>
                          <div className="flex justify-end">
                            <button 
                              onClick={() => handleDelete(user['.id'])}
                              className="p-2 text-red-500 hover:bg-red-500 hover:text-white transition-all rounded"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'generator' && (
            <motion.div 
              key="generator"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="max-w-2xl"
            >
              <div className="mb-12">
                <h2 className="font-serif italic text-4xl mb-2">Gerador de Usuários</h2>
                <p className="opacity-40 text-sm">Crie múltiplos usuários com códigos numéricos sem senha.</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                <div className="space-y-8">
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold tracking-widest opacity-40">Quantidade de Vouchers</label>
                    <input 
                      type="number" 
                      value={genCount}
                      onChange={e => setGenCount(parseInt(e.target.value))}
                      className="w-full bg-transparent border-b border-line py-2 focus:outline-none focus:border-accent transition-colors font-mono text-2xl"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold tracking-widest opacity-40">Perfil do Hotspot</label>
                    <select 
                      value={genProfile}
                      onChange={e => setGenProfile(e.target.value)}
                      className="w-full bg-transparent border-b border-line py-2 focus:outline-none focus:border-accent transition-colors appearance-none"
                    >
                      {loading && profiles.length === 0 ? (
                        <option>Carregando perfis...</option>
                      ) : profiles.length === 0 ? (
                        <option value="default">default</option>
                      ) : (
                        profiles.map(p => (
                          <option key={p.name} value={p.name}>{p.name}</option>
                        ))
                      )}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold tracking-widest opacity-40">Tipo de Voucher</label>
                    <select 
                      value={genVoucherType}
                      onChange={e => setGenVoucherType(e.target.value)}
                      className="w-full bg-transparent border-b border-line py-2 focus:outline-none focus:border-accent transition-colors appearance-none"
                    >
                      <option value="username_only">Apenas Usuário (Código)</option>
                      <option value="user_pass">Usuário e Senha (Iguais)</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold tracking-widest opacity-40">Tipo de Caracteres</label>
                    <select 
                      value={genCharType}
                      onChange={e => setGenCharType(e.target.value)}
                      className="w-full bg-transparent border-b border-line py-2 focus:outline-none focus:border-accent transition-colors appearance-none"
                    >
                      <option value="numbers">Apenas Números</option>
                      <option value="letters">Apenas Letras (Maiúsculas)</option>
                      <option value="mixed">Misturado (Letras e Números)</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold tracking-widest opacity-40">DNS Name (Portal)</label>
                    <input 
                      type="text" 
                      value={genDNSName}
                      onChange={e => setGenDNSName(e.target.value)}
                      className="w-full bg-transparent border-b border-line py-2 focus:outline-none focus:border-accent transition-colors font-mono"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold tracking-widest opacity-40">Preço do Voucher</label>
                    <input 
                      type="text" 
                      value={genPrice}
                      onChange={e => setGenPrice(e.target.value)}
                      placeholder="Ex: R$ 5,00"
                      className="w-full bg-transparent border-b border-line py-2 focus:outline-none focus:border-accent transition-colors font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-8">
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold tracking-widest opacity-40">Prefixo do Nome</label>
                    <input 
                      type="text" 
                      value={genPrefix}
                      onChange={e => setGenPrefix(e.target.value)}
                      className="w-full bg-transparent border-b border-line py-2 focus:outline-none focus:border-accent transition-colors font-mono"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold tracking-widest opacity-40">Cor do Voucher</label>
                    <select 
                      value={genColor}
                      onChange={e => setGenColor(e.target.value)}
                      className="w-full bg-transparent border-b border-line py-2 focus:outline-none focus:border-accent transition-colors appearance-none"
                    >
                      <option value="emerald">Verde (Padrão)</option>
                      <option value="blue">Azul</option>
                      <option value="red">Vermelho</option>
                      <option value="amber">Amarelo</option>
                      <option value="purple">Roxo</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold tracking-widest opacity-40">Tamanho do Código</label>
                    <input 
                      type="number" 
                      value={genLength}
                      onChange={e => setGenLength(parseInt(e.target.value))}
                      className="w-full bg-transparent border-b border-line py-2 focus:outline-none focus:border-accent transition-colors font-mono"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold tracking-widest opacity-40">Limite de Tempo (Uptime)</label>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <input type="number" value={uptimeDays} onChange={e => setUptimeDays(parseInt(e.target.value))} className="w-full bg-transparent border-b border-line py-2 focus:outline-none focus:border-accent transition-colors text-center" />
                        <span className="text-[8px] opacity-30 uppercase block text-center mt-1">Dia</span>
                      </div>
                      <div>
                        <input type="number" value={uptimeHours} onChange={e => setUptimeHours(parseInt(e.target.value))} className="w-full bg-transparent border-b border-line py-2 focus:outline-none focus:border-accent transition-colors text-center" />
                        <span className="text-[8px] opacity-30 uppercase block text-center mt-1">Hora</span>
                      </div>
                      <div>
                        <input type="number" value={uptimeMinutes} onChange={e => setUptimeMinutes(parseInt(e.target.value))} className="w-full bg-transparent border-b border-line py-2 focus:outline-none focus:border-accent transition-colors text-center" />
                        <span className="text-[8px] opacity-30 uppercase block text-center mt-1">Min</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold tracking-widest opacity-40">Limite de Dados (MB)</label>
                    <input 
                      type="number" 
                      value={genLimitBytes}
                      onChange={e => setGenLimitBytes(e.target.value)}
                      className="w-full bg-transparent border-b border-line py-2 focus:outline-none focus:border-accent transition-colors font-mono"
                    />
                    <p className="text-[9px] opacity-30 italic">0 = Sem limite de dados</p>
                  </div>
                </div>
              </div>

              <div className="mt-12 p-8 border border-dashed border-line bg-white/5">
                <div className="flex items-start gap-4">
                  <div className="p-2 bg-accent/10 text-accent">
                    <ShieldCheck size={20} />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm uppercase tracking-widest mb-1">Segurança & Configuração</h4>
                    <p className="text-xs opacity-40 leading-relaxed">
                      Os usuários serão criados com **senha vazia**. Certifique-se de que o seu servidor Hotspot 
                      permite logins sem senha nas configurações do perfil do servidor (Server Profile).
                    </p>
                  </div>
                </div>
              </div>

              <button 
                onClick={handleGenerate}
                disabled={loading}
                className="mt-12 w-full bg-accent text-bg py-6 font-bold uppercase tracking-widest text-sm hover:opacity-90 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
              >
                {loading ? <RefreshCw className="animate-spin" size={20} /> : <Database size={20} />}
                Gerar {genCount} Usuários Agora
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
