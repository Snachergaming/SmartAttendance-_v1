import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Activity, Users, CheckCircle, XCircle, RefreshCw, Monitor } from 'lucide-react';
import PageShell from '@/components/layout/PageShell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import StatusBadge from '@/components/ui/StatusBadge';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { getActiveSessionAttendance, type SimpleDeviceSession } from '@/services/devices';
import { Badge } from '@/components/ui/badge';

interface AttendanceRecord {
  id: string;
  status: 'PRESENT' | 'ABSENT';
  student_id: string;
  students: {
    id: string;
    name: string;
    roll_no: number;
    enrollment_no?: string;
  };
}

interface ActiveSessionData {
  session: {
    attendance_session_id: string;
    class_name: string;
    subject_name: string;
  };
  records: AttendanceRecord[];
}

interface ActiveDevice {
  device_code: string;
  session: SimpleDeviceSession;
  attendance: ActiveSessionData | null;
  lastUpdated: string;
}

const LiveAttendanceMonitorPage: React.FC = () => {
  const [activeDevices, setActiveDevices] = useState<ActiveDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<string>('');

  const fetchActiveDevices = useCallback(async () => {
    try {
      // Get all active device sessions
      const { data: sessions, error } = await supabase
        .from('device_sessions')
        .select('*')
        .eq('session_status', 'ACTIVE')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const devices: ActiveDevice[] = [];

      for (const session of sessions) {
        // Get attendance data for each device
        const attendanceData = await getActiveSessionAttendance(session.device_code);

        devices.push({
          device_code: session.device_code,
          session: session,
          attendance: attendanceData,
          lastUpdated: new Date().toISOString()
        });
      }

      setActiveDevices(devices);
      setLastRefresh(new Date().toLocaleTimeString());
    } catch (error) {
      console.error('Error fetching active devices:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch active sessions',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchActiveDevices();

    // Refresh every 2 seconds for more responsive updates
    const interval = setInterval(fetchActiveDevices, 2000);

    return () => clearInterval(interval);
  }, [fetchActiveDevices]);

  // Subscribe to real-time updates for multiple tables
  useEffect(() => {
    console.log('🔔 Setting up real-time subscriptions...');

    const deviceUpdatesChannel = supabase
      .channel('device_session_updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'device_sessions'
        },
        (payload) => {
          console.log('📱 Device session update:', payload);
          // Immediately refresh when device is configured/updated
          fetchActiveDevices();

          if (payload.eventType === 'INSERT') {
            toast({
              title: 'New Session Started',
              description: `Device ${payload.new.device_code} configured`,
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'attendance_records'
        },
        (payload) => {
          console.log('📝 Attendance record update:', payload);

          // Refresh data when any attendance is updated
          fetchActiveDevices();

          // Show toast for present attendance only
          if (payload.new.status === 'PRESENT') {
            toast({
              title: '✅ Student Marked Present',
              description: 'Attendance updated via fingerprint scan',
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'attendance_sessions'
        },
        (payload) => {
          console.log('📊 Attendance session update:', payload);
          // Refresh when attendance session is created/updated
          fetchActiveDevices();
        }
      )
      .subscribe((status) => {
        console.log('📡 Subscription status:', status);
      });

    return () => {
      console.log('🔕 Unsubscribing from real-time updates');
      deviceUpdatesChannel.unsubscribe();
    };
  }, [fetchActiveDevices]);

  const getAttendanceStats = (records: AttendanceRecord[]) => {
    const present = records.filter(r => r.status === 'PRESENT').length;
    const absent = records.filter(r => r.status === 'ABSENT').length;
    const total = records.length;
    const percentage = total > 0 ? Math.round((present / total) * 100) : 0;

    return { present, absent, total, percentage };
  };

  const handleRefresh = () => {
    setLoading(true);
    fetchActiveDevices();
  };

  return (
    <PageShell role="admin">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">
              Live Attendance Monitor
            </h1>
            <p className="text-muted-foreground mt-1">Real-time attendance tracking for active sessions</p>
            {lastRefresh && (
              <p className="text-xs text-muted-foreground mt-1">
                Last updated: {lastRefresh} (Auto-refreshing every 2s)
              </p>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Badge
              variant={activeDevices.length > 0 ? "default" : "secondary"}
              className="flex items-center gap-1"
            >
              <Activity className={`w-3 h-3 ${activeDevices.length > 0 ? 'text-green-400' : ''}`} />
              {activeDevices.length} Active Session{activeDevices.length !== 1 ? 's' : ''}
            </Badge>
            <Button
              onClick={handleRefresh}
              disabled={loading}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Refreshing...' : 'Refresh'}
            </Button>
            <Button
              onClick={() => window.open('/admin/devices', '_blank')}
              variant="default"
              size="sm"
              className="flex items-center gap-2"
            >
              <Monitor className="w-4 h-4" />
              Configure Device
            </Button>
          </div>
        </div>

        {lastRefresh && (
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300 text-xs font-medium">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              Live • Last updated: {lastRefresh}
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <RefreshCw className="w-6 h-6 animate-spin" />
          </div>
        ) : activeDevices.length === 0 ? (
          <Card className="glass-card border-border/50">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Monitor className="w-16 h-16 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No Active Sessions</h3>
              <p className="text-muted-foreground text-center max-w-md mb-6">
                Configure a device to start taking attendance. Students will automatically be marked as ABSENT, then change to PRESENT when they scan their fingerprint.
              </p>
              <div className="flex gap-3">
                <Button
                  onClick={() => window.open('/admin/devices', '_blank')}
                  variant="default"
                  className="flex items-center gap-2"
                >
                  <Monitor className="w-4 h-4" />
                  Configure Device
                </Button>
                <Button
                  onClick={handleRefresh}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Check Again
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6">
            {activeDevices.map((device) => {
              const stats = device.attendance ? getAttendanceStats(device.attendance.records) : null;

              return (
                <Card key={device.device_code} className="glass-card border-border/50">
                  <CardHeader className="pb-4">
                    <div className="flex flex-col sm:flex-row justify-between items-start gap-2">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <Monitor className="w-5 h-5" />
                          Device {device.device_code}
                        </CardTitle>
                        <div className="flex flex-wrap gap-2 mt-2">
                          <Badge variant="outline">{device.attendance?.session.class_name}</Badge>
                          <Badge variant="outline">{device.attendance?.session.subject_name}</Badge>
                          <Badge variant="secondary">{device.session.faculty_email}</Badge>
                        </div>
                      </div>

                      {stats && (
                        <div className="flex items-center gap-4 text-sm">
                          <div className="flex items-center gap-1 text-green-600">
                            <CheckCircle className="w-4 h-4" />
                            {stats.present}
                          </div>
                          <div className="flex items-center gap-1 text-red-500">
                            <XCircle className="w-4 h-4" />
                            {stats.absent}
                          </div>
                          <div className="flex items-center gap-1">
                            <Users className="w-4 h-4" />
                            {stats.total}
                          </div>
                          <Badge variant={stats.percentage >= 75 ? 'default' : 'secondary'}>
                            {stats.percentage}%
                          </Badge>
                        </div>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent>
                    {!device.attendance ? (
                      <div className="text-center py-8 text-muted-foreground">
                        No attendance session linked to this device
                      </div>
                    ) : device.attendance.records.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        No students in this session
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        <div className="text-xs text-muted-foreground mb-3 p-2 bg-background/20 rounded">
                          💡 <strong>How it works:</strong> All students start as ABSENT. When they scan their fingerprint, they automatically become PRESENT.
                        </div>
                        {device.attendance.records
                          .sort((a, b) => {
                            // Sort by status first (PRESENT first), then by roll number
                            if (a.status !== b.status) {
                              return a.status === 'PRESENT' ? -1 : 1;
                            }
                            return a.students.roll_no - b.students.roll_no;
                          })
                          .map((record) => {
                            const isPresent = record.status === 'PRESENT';
                            return (
                              <motion.div
                                key={record.id}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                                  isPresent
                                    ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                                    : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                                }`}
                              >
                                <div className="flex items-center gap-3">
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                                    isPresent
                                      ? 'bg-green-500 text-white'
                                      : 'bg-red-500 text-white'
                                  }`}>
                                    {record.students.roll_no}
                                  </div>
                                  <div>
                                    <div className="font-medium">{record.students.name}</div>
                                    {record.students.enrollment_no && (
                                      <div className="text-xs text-muted-foreground">
                                        {record.students.enrollment_no}
                                      </div>
                                    )}
                                  </div>
                                </div>

                                <StatusBadge
                                  variant={isPresent ? 'success' : 'danger'}
                                  className="flex items-center gap-2"
                                >
                                  {isPresent ? (
                                    <>
                                      <CheckCircle className="w-3 h-3" />
                                      <span>PRESENT</span>
                                    </>
                                  ) : (
                                    <>
                                      <XCircle className="w-3 h-3" />
                                      <span>ABSENT</span>
                                    </>
                                  )}
                                </StatusBadge>
                              </motion.div>
                            );
                          })
                        }
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </motion.div>
    </PageShell>
  );
};

export default LiveAttendanceMonitorPage;