import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Fingerprint,
  Wifi,
  WifiOff,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Trash2,
  Power,
  PowerOff,
  Clock,
  Users,
  AlertCircle,
} from 'lucide-react';
import PageShell from '@/components/layout/PageShell';
import DataTable from '@/components/ui/DataTable';
import StatusBadge from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface FingerprintDevice {
  id: string;
  device_code: string;
  device_name: string | null;
  status: string;
  last_seen_at: string | null;
  firmware_version: string | null;
  enrollment_mode: boolean;
  created_at: string;
}

interface DeviceStats {
  total: number;
  online: number;
  offline: number;
  enrolledStudents: number;
}

const AdminDevicesPage: React.FC = () => {
  const [devices, setDevices] = useState<FingerprintDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [stats, setStats] = useState<DeviceStats>({
    total: 0,
    online: 0,
    offline: 0,
    enrolledStudents: 0,
  });
  const [newDevice, setNewDevice] = useState({
    device_code: '',
    device_name: '',
  });

  const fetchDevices = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('fingerprint_devices')
        .select('*')
        .order('device_code');

      if (error) throw error;
      setDevices(data || []);

      // Calculate stats
      const now = new Date();
      const online = (data || []).filter((d) => {
        if (!d.last_seen_at) return false;
        const lastSeen = new Date(d.last_seen_at);
        return (now.getTime() - lastSeen.getTime()) / (1000 * 60) < 2;
      }).length;

      // Get enrolled students count
      const { count: enrolledCount } = await supabase
        .from('fingerprint_templates')
        .select('*', { count: 'exact', head: true });

      setStats({
        total: data?.length || 0,
        online,
        offline: (data?.length || 0) - online,
        enrolledStudents: enrolledCount || 0,
      });
    } catch (error) {
      console.error('Error fetching devices:', error);
      toast({
        title: 'Error',
        description: 'Failed to load devices',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDevices();

    // Set up real-time subscription
    const subscription = supabase
      .channel('devices_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'fingerprint_devices' },
        () => {
          fetchDevices();
        }
      )
      .subscribe();

    // Refresh every 30 seconds to update online status
    const interval = setInterval(fetchDevices, 30000);

    return () => {
      subscription.unsubscribe();
      clearInterval(interval);
    };
  }, []);

  const filteredDevices = devices.filter(
    (d) =>
      d.device_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.device_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const isDeviceOnline = (device: FingerprintDevice): boolean => {
    if (!device.last_seen_at) return false;
    const lastSeen = new Date(device.last_seen_at);
    const now = new Date();
    return (now.getTime() - lastSeen.getTime()) / (1000 * 60) < 2;
  };

  const formatLastSeen = (lastSeen: string | null): string => {
    if (!lastSeen) return 'Never';
    const date = new Date(lastSeen);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    return date.toLocaleDateString('en-IN');
  };

  const handleAddDevice = async () => {
    if (!newDevice.device_code.trim()) {
      toast({
        title: 'Error',
        description: 'Device code is required',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('fingerprint_devices').insert({
        device_code: newDevice.device_code.toUpperCase().trim(),
        device_name: newDevice.device_name.trim() || null,
        status: 'ACTIVE',
      });

      if (error) {
        if (error.code === '23505') {
          throw new Error('A device with this code already exists');
        }
        throw error;
      }

      toast({
        title: 'Success',
        description: `Device ${newDevice.device_code} added successfully`,
      });
      setIsAddDialogOpen(false);
      setNewDevice({ device_code: '', device_name: '' });
      fetchDevices();
    } catch (error: unknown) {
      console.error('Error adding device:', error);
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to add device',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (
    id: string,
    currentStatus: string
  ) => {
    try {
      const newStatus = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      const { error } = await supabase
        .from('fingerprint_devices')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: `Device ${newStatus === 'ACTIVE' ? 'activated' : 'deactivated'}`,
      });
      fetchDevices();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update device status',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteDevice = async (id: string, deviceCode: string) => {
    if (
      !confirm(
        `Are you sure you want to delete device ${deviceCode}? This cannot be undone.`
      )
    ) {
      return;
    }

    try {
      const { error } = await supabase
        .from('fingerprint_devices')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({ title: 'Success', description: 'Device deleted' });
      fetchDevices();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete device',
        variant: 'destructive',
      });
    }
  };

  const columns = [
    {
      key: 'status_indicator',
      header: '',
      cell: (device: FingerprintDevice) => (
        <div className="flex items-center justify-center">
          {isDeviceOnline(device) ? (
            <Wifi className="w-5 h-5 text-success animate-pulse" />
          ) : (
            <WifiOff className="w-5 h-5 text-muted-foreground" />
          )}
        </div>
      ),
    },
    { key: 'device_code', header: 'Device Code' },
    {
      key: 'device_name',
      header: 'Name',
      cell: (device: FingerprintDevice) =>
        device.device_name || (
          <span className="text-muted-foreground">-</span>
        ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (device: FingerprintDevice) => (
        <StatusBadge
          variant={device.status === 'ACTIVE' ? 'success' : 'warning'}
        >
          {device.status}
        </StatusBadge>
      ),
    },
    {
      key: 'last_seen_at',
      header: 'Last Seen',
      cell: (device: FingerprintDevice) => (
        <span
          className={
            isDeviceOnline(device)
              ? 'text-success'
              : 'text-muted-foreground'
          }
        >
          {formatLastSeen(device.last_seen_at)}
        </span>
      ),
    },
    {
      key: 'firmware_version',
      header: 'Firmware',
      cell: (device: FingerprintDevice) =>
        device.firmware_version ? (
          <span className="font-mono text-sm">
            v{device.firmware_version}
          </span>
        ) : (
          <span className="text-muted-foreground">-</span>
        ),
    },
    {
      key: 'actions',
      header: 'Actions',
      cell: (device: FingerprintDevice) => (
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleToggleStatus(device.id, device.status)}
            title={device.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
          >
            {device.status === 'ACTIVE' ? (
              <PowerOff className="w-4 h-4 text-warning" />
            ) : (
              <Power className="w-4 h-4 text-success" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              handleDeleteDevice(device.id, device.device_code)
            }
            title="Delete Device"
          >
            <Trash2 className="w-4 h-4 text-danger" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <PageShell role="admin">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="space-y-6"
      >
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">
              Device Management
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage fingerprint attendance devices
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={fetchDevices}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            <Button onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Device
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Devices
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Fingerprint className="w-5 h-5 text-primary" />
                <span className="text-2xl font-bold">{stats.total}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Online
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Wifi className="w-5 h-5 text-success" />
                <span className="text-2xl font-bold text-success">
                  {stats.online}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Offline
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <WifiOff className="w-5 h-5 text-muted-foreground" />
                <span className="text-2xl font-bold">{stats.offline}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Enrolled Students
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-accent" />
                <span className="text-2xl font-bold">
                  {stats.enrolledStudents}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Table */}
        <div className="glass-card rounded-xl p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search devices..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <DataTable
            data={filteredDevices}
            columns={columns}
            isLoading={loading}
            keyExtractor={(device) => device.id}
            emptyMessage="No devices registered"
          />
        </div>

        {/* Setup Instructions */}
        <div className="glass-card rounded-xl p-4 sm:p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Device Setup Instructions
          </h2>
          <div className="space-y-4 text-sm text-muted-foreground">
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold shrink-0">
                1
              </div>
              <div>
                <p className="font-medium text-foreground">
                  Register the device
                </p>
                <p>
                  Click "Add Device" and enter a unique device code (e.g.,
                  DEVICE_001). This code will be used by the ESP32 device
                  to identify itself.
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold shrink-0">
                2
              </div>
              <div>
                <p className="font-medium text-foreground">
                  Configure the ESP32
                </p>
                <p>
                  Download the firmware from{' '}
                  <code className="bg-muted px-1 rounded">
                    esp32-firmware/
                  </code>{' '}
                  folder. Update the config with WiFi credentials, Supabase
                  URL and the device code you registered.
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold shrink-0">
                3
              </div>
              <div>
                <p className="font-medium text-foreground">
                  Flash and power on
                </p>
                <p>
                  Upload the firmware to the ESP32 using PlatformIO. Once
                  powered on, the device will automatically connect and
                  show as "Online" in this dashboard.
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold shrink-0">
                4
              </div>
              <div>
                <p className="font-medium text-foreground">
                  Enroll students
                </p>
                <p>
                  Go to Admin → Student Enrollment to register student
                  fingerprints. Faculty can then use the device during
                  attendance sessions.
                </p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Add Device Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Fingerprint className="w-5 h-5" />
              Add New Device
            </DialogTitle>
            <DialogDescription>
              Register a new fingerprint device. The device code must match
              the code configured in the ESP32 firmware.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="device_code">Device Code *</Label>
              <Input
                id="device_code"
                placeholder="e.g., DEVICE_001"
                value={newDevice.device_code}
                onChange={(e) =>
                  setNewDevice({
                    ...newDevice,
                    device_code: e.target.value.toUpperCase(),
                  })
                }
              />
              <p className="text-xs text-muted-foreground">
                Use a unique identifier like DEVICE_001, ROOM_A101, etc.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="device_name">Display Name (Optional)</Label>
              <Input
                id="device_name"
                placeholder="e.g., Classroom A101"
                value={newDevice.device_name}
                onChange={(e) =>
                  setNewDevice({ ...newDevice, device_name: e.target.value })
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsAddDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleAddDevice} disabled={isSubmitting}>
              {isSubmitting ? 'Adding...' : 'Add Device'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
};

export default AdminDevicesPage;
