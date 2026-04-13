import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Fingerprint,
  Search,
  Users,
  CheckCircle,
  XCircle,
  Loader2,
  RefreshCw,
  Wifi,
  WifiOff,
  AlertCircle,
  Filter,
  Trash2,
  Play,
} from 'lucide-react';
import PageShell from '@/components/layout/PageShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { getClasses, type Class } from '@/services/classes';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Student {
  id: string;
  name: string;
  enrollment_no: string;
  roll_no: number;
  class_id: string;
  mobile?: string;
}

interface StudentWithEnrollment extends Student {
  has_fingerprint: boolean;
  fingerprint_id?: number;
}

interface FingerprintDevice {
  id: string;
  device_code: string;
  device_name: string | null;
  last_seen_at: string | null;
}

const StudentEnrollmentPage: React.FC = () => {
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [students, setStudents] = useState<StudentWithEnrollment[]>([]);
  const [devices, setDevices] = useState<FingerprintDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showEnrollDialog, setShowEnrollDialog] = useState(false);
  const [enrollingStudent, setEnrollingStudent] =
    useState<StudentWithEnrollment | null>(null);
  const [enrollmentStatus, setEnrollmentStatus] = useState<
    'idle' | 'waiting' | 'success' | 'error'
  >('idle');
  const [filter, setFilter] = useState<'all' | 'enrolled' | 'not_enrolled'>(
    'all'
  );

  // Fetch classes
  useEffect(() => {
    const fetchClasses = async () => {
      try {
        const data = await getClasses();
        setClasses(data);
        if (data.length > 0 && !selectedClass) {
          setSelectedClass(data[0].id);
        }
      } catch (error) {
        console.error('Error fetching classes:', error);
      }
    };
    fetchClasses();
  }, []);

  // Fetch devices
  useEffect(() => {
    const fetchDevices = async () => {
      try {
        const { data, error } = await supabase
          .from('fingerprint_devices')
          .select('id, device_code, device_name, last_seen_at')
          .eq('status', 'ACTIVE')
          .order('device_code');

        if (error) throw error;
        setDevices(data || []);

        // Auto-select first online device
        const onlineDevice = data?.find((d) => isDeviceOnline(d));
        if (onlineDevice && !selectedDevice) {
          setSelectedDevice(onlineDevice.device_code);
        }
      } catch (error) {
        console.error('Error fetching devices:', error);
      }
    };
    fetchDevices();

    // Refresh device status every 30 seconds
    const interval = setInterval(fetchDevices, 30000);
    return () => clearInterval(interval);
  }, []);

  // Fetch students when class changes
  useEffect(() => {
    if (selectedClass) {
      fetchStudents();
    }
  }, [selectedClass]);

  const fetchStudents = async () => {
    if (!selectedClass) return;

    setLoading(true);
    try {
      // Get students
      const { data: studentData, error: studentError } = await supabase
        .from('students')
        .select('id, name, enrollment_no, roll_no, class_id, mobile')
        .eq('class_id', selectedClass)
        .eq('status', 'ACTIVE')
        .order('roll_no');

      if (studentError) throw studentError;

      // Get fingerprint templates
      const studentIds = studentData?.map((s) => s.id) || [];
      const { data: templates, error: templateError } = await supabase
        .from('fingerprint_templates')
        .select('student_id, fingerprint_id')
        .in('student_id', studentIds);

      if (templateError) throw templateError;

      const templateMap = new Map(
        templates?.map((t) => [t.student_id, t.fingerprint_id])
      );

      const studentsWithEnrollment: StudentWithEnrollment[] = (
        studentData || []
      ).map((s) => ({
        ...s,
        has_fingerprint: templateMap.has(s.id),
        fingerprint_id: templateMap.get(s.id),
      }));

      setStudents(studentsWithEnrollment);
    } catch (error) {
      console.error('Error fetching students:', error);
      toast({
        title: 'Error',
        description: 'Failed to load students',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const isDeviceOnline = (device: FingerprintDevice): boolean => {
    if (!device.last_seen_at) return false;
    const lastSeen = new Date(device.last_seen_at);
    const now = new Date();
    return (now.getTime() - lastSeen.getTime()) / (1000 * 60) < 2;
  };

  const getSelectedDevice = (): FingerprintDevice | undefined => {
    return devices.find((d) => d.device_code === selectedDevice);
  };

  const filteredStudents = students.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.enrollment_no.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.roll_no.toString().includes(searchTerm);

    const matchesFilter =
      filter === 'all' ||
      (filter === 'enrolled' && s.has_fingerprint) ||
      (filter === 'not_enrolled' && !s.has_fingerprint);

    return matchesSearch && matchesFilter;
  });

  const enrolledCount = students.filter((s) => s.has_fingerprint).length;
  const enrollmentPercentage =
    students.length > 0
      ? Math.round((enrolledCount / students.length) * 100)
      : 0;

  const startEnrollment = async (student: StudentWithEnrollment) => {
    if (!selectedDevice) {
      toast({
        title: 'No Device Selected',
        description: 'Please select a fingerprint device first',
        variant: 'destructive',
      });
      return;
    }

    const device = getSelectedDevice();
    if (!device || !isDeviceOnline(device)) {
      toast({
        title: 'Device Offline',
        description: 'Selected device is not online. Please check the device.',
        variant: 'destructive',
      });
      return;
    }

    setEnrollingStudent(student);
    setEnrollmentStatus('idle');
    setShowEnrollDialog(true);
  };

  const confirmEnrollment = async () => {
    if (!enrollingStudent || !selectedDevice) return;

    setEnrollmentStatus('waiting');

    try {
      // Get next available fingerprint ID
      const { data: nextIdResult } = await supabase.rpc(
        'get_next_fingerprint_id'
      );

      const fingerprintId = nextIdResult || 1;

      // Add to enrollment queue
      const { error: queueError } = await supabase
        .from('fingerprint_enrollment_queue')
        .insert({
          device_code: selectedDevice,
          student_id: enrollingStudent.id,
          fingerprint_id: fingerprintId,
          status: 'PENDING',
        });

      if (queueError) throw queueError;

      // Subscribe to template updates for this student
      const subscription = supabase
        .channel(`enrollment_${enrollingStudent.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'fingerprint_templates',
            filter: `student_id=eq.${enrollingStudent.id}`,
          },
          (payload) => {
            if (payload.new) {
              setEnrollmentStatus('success');
              toast({
                title: 'Enrollment Successful!',
                description: `${enrollingStudent.name}'s fingerprint has been enrolled.`,
              });
              fetchStudents();

              setTimeout(() => {
                subscription.unsubscribe();
                setShowEnrollDialog(false);
                setEnrollingStudent(null);
              }, 2000);
            }
          }
        )
        .subscribe();

      // Timeout after 60 seconds
      setTimeout(() => {
        if (enrollmentStatus === 'waiting') {
          setEnrollmentStatus('error');
          subscription.unsubscribe();
        }
      }, 60000);
    } catch (error) {
      console.error('Enrollment error:', error);
      setEnrollmentStatus('error');
      toast({
        title: 'Error',
        description: 'Failed to start enrollment. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const deleteFingerprint = async (student: StudentWithEnrollment) => {
    if (
      !confirm(
        `Are you sure you want to delete ${student.name}'s fingerprint enrollment?`
      )
    ) {
      return;
    }

    try {
      const { error } = await supabase
        .from('fingerprint_templates')
        .delete()
        .eq('student_id', student.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Fingerprint enrollment deleted',
      });
      fetchStudents();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete fingerprint',
        variant: 'destructive',
      });
    }
  };

  const selectedClassName =
    classes.find((c) => c.id === selectedClass)?.name || '';

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
              Student Enrollment
            </h1>
            <p className="text-muted-foreground mt-1">
              Enroll student fingerprints for biometric attendance
            </p>
          </div>
          <Button variant="outline" onClick={fetchStudents}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Device and Class Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Device Selection Card */}
          <Card className="glass-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Fingerprint className="w-4 h-4" />
                Select Device
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Select
                value={selectedDevice}
                onValueChange={setSelectedDevice}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a device" />
                </SelectTrigger>
                <SelectContent>
                  {devices.map((device) => (
                    <SelectItem
                      key={device.device_code}
                      value={device.device_code}
                    >
                      <div className="flex items-center gap-2">
                        {isDeviceOnline(device) ? (
                          <Wifi className="w-4 h-4 text-success" />
                        ) : (
                          <WifiOff className="w-4 h-4 text-muted-foreground" />
                        )}
                        <span>
                          {device.device_name || device.device_code}
                        </span>
                        {!isDeviceOnline(device) && (
                          <span className="text-xs text-muted-foreground">
                            (Offline)
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedDevice && (
                <div className="mt-2 flex items-center gap-2 text-sm">
                  {getSelectedDevice() &&
                    isDeviceOnline(getSelectedDevice()!) ? (
                    <>
                      <Wifi className="w-4 h-4 text-success" />
                      <span className="text-success">Device Online</span>
                    </>
                  ) : (
                    <>
                      <WifiOff className="w-4 h-4 text-warning" />
                      <span className="text-warning">Device Offline</span>
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Class Selection Card */}
          <Card className="glass-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Users className="w-4 h-4" />
                Select Class
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Select
                value={selectedClass}
                onValueChange={setSelectedClass}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a class" />
                </SelectTrigger>
                <SelectContent>
                  {classes.map((cls) => (
                    <SelectItem key={cls.id} value={cls.id}>
                      {cls.name} - {cls.division}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedClass && (
                <div className="mt-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">
                      Enrollment Progress
                    </span>
                    <span className="text-sm font-medium">
                      {enrolledCount}/{students.length}
                    </span>
                  </div>
                  <Progress value={enrollmentPercentage} className="h-2" />
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Students List */}
        <div className="glass-card rounded-xl p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, enrollment no, or roll no..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-background"
              />
            </div>
            <Select
              value={filter}
              onValueChange={(v) =>
                setFilter(v as 'all' | 'enrolled' | 'not_enrolled')
              }
            >
              <SelectTrigger className="w-[180px]">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Students</SelectItem>
                <SelectItem value="enrolled">Enrolled</SelectItem>
                <SelectItem value="not_enrolled">Not Enrolled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              <AnimatePresence>
                {filteredStudents.map((student) => (
                  <motion.div
                    key={student.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${student.has_fingerprint
                        ? 'bg-success/5 border-success/20'
                        : 'bg-muted/20 border-border'
                      }`}
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center ${student.has_fingerprint
                            ? 'bg-success/20'
                            : 'bg-muted'
                          }`}
                      >
                        {student.has_fingerprint ? (
                          <CheckCircle className="w-5 h-5 text-success" />
                        ) : (
                          <XCircle className="w-5 h-5 text-muted-foreground" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium">{student.name}</p>
                        <p className="text-sm text-muted-foreground">
                          Roll: {student.roll_no} • {student.enrollment_no}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {student.has_fingerprint ? (
                        <>
                          <span className="text-xs text-success bg-success/10 px-2 py-1 rounded">
                            ID: {student.fingerprint_id}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteFingerprint(student)}
                            title="Delete Fingerprint"
                          >
                            <Trash2 className="w-4 h-4 text-danger" />
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => startEnrollment(student)}
                          className="gap-2"
                        >
                          <Play className="w-4 h-4" />
                          Enroll
                        </Button>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {filteredStudents.length === 0 && !loading && (
                <div className="text-center py-12 text-muted-foreground">
                  {searchTerm || filter !== 'all'
                    ? 'No students match your search/filter'
                    : 'No students in this class'}
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>

      {/* Enrollment Dialog */}
      <Dialog open={showEnrollDialog} onOpenChange={setShowEnrollDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Fingerprint className="w-5 h-5" />
              Fingerprint Enrollment
            </DialogTitle>
            <DialogDescription>
              Enroll fingerprint for {enrollingStudent?.name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Student Info */}
            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="font-medium">{enrollingStudent?.name}</p>
              <p className="text-sm text-muted-foreground">
                Roll: {enrollingStudent?.roll_no} •{' '}
                {enrollingStudent?.enrollment_no}
              </p>
            </div>

            {/* Status Display */}
            <div className="flex flex-col items-center py-6">
              {enrollmentStatus === 'idle' && (
                <>
                  <Fingerprint className="w-16 h-16 text-primary mb-4" />
                  <p className="text-center">
                    Click "Start Enrollment" and ask the student to place
                    their finger on the sensor.
                  </p>
                </>
              )}

              {enrollmentStatus === 'waiting' && (
                <>
                  <motion.div
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                  >
                    <Fingerprint className="w-16 h-16 text-primary mb-4" />
                  </motion.div>
                  <Loader2 className="w-6 h-6 animate-spin text-primary mb-2" />
                  <p className="text-center font-medium">
                    Waiting for enrollment...
                  </p>
                  <p className="text-sm text-muted-foreground text-center">
                    Ask the student to place their finger on the device.
                    <br />
                    They will need to scan twice.
                  </p>
                </>
              )}

              {enrollmentStatus === 'success' && (
                <>
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring' }}
                  >
                    <CheckCircle className="w-16 h-16 text-success mb-4" />
                  </motion.div>
                  <p className="text-center font-medium text-success">
                    Enrollment Successful!
                  </p>
                  <p className="text-sm text-muted-foreground text-center">
                    {enrollingStudent?.name}'s fingerprint has been
                    registered.
                  </p>
                </>
              )}

              {enrollmentStatus === 'error' && (
                <>
                  <AlertCircle className="w-16 h-16 text-danger mb-4" />
                  <p className="text-center font-medium text-danger">
                    Enrollment Failed
                  </p>
                  <p className="text-sm text-muted-foreground text-center">
                    The enrollment timed out or failed. Please try again.
                  </p>
                </>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowEnrollDialog(false);
                setEnrollingStudent(null);
                setEnrollmentStatus('idle');
              }}
            >
              {enrollmentStatus === 'success' ? 'Done' : 'Cancel'}
            </Button>
            {enrollmentStatus === 'idle' && (
              <Button onClick={confirmEnrollment} className="btn-gradient">
                <Play className="w-4 h-4 mr-2" />
                Start Enrollment
              </Button>
            )}
            {enrollmentStatus === 'error' && (
              <Button onClick={confirmEnrollment}>Try Again</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
};

export default StudentEnrollmentPage;
