import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Fingerprint,
  Wifi,
  WifiOff,
  AlertCircle,
  CheckCircle,
  Loader2,
  Play,
  RotateCcw,
  Smartphone,
  User,
  Search,
  RefreshCw,
  Trash2,
  AlertTriangle,
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
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface FingerprintDevice {
  id: string;
  device_code: string;
  device_name: string | null;
  last_seen_at: string | null;
  status: string;
}

interface Student {
  id: string;
  name: string;
  enrollment_no: string;
  roll_no: number;
  class_id: string;
  mobile?: string;
  has_fingerprint?: boolean;
  fingerprint_id?: number;
}

type EnrollmentStep = 'idle' | 'enter_student' | 'searching' | 'confirming' | 'first_scan' | 'second_scan' | 'saving' | 'success' | 'verify' | 'verify_result' | 'error';

const QuickEnrollment: React.FC = () => {
  const [devices, setDevices] = useState<FingerprintDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>('');
  const [enrollmentStep, setEnrollmentStep] = useState<EnrollmentStep>('idle');
  const [searchQuery, setSearchQuery] = useState('');
  const [foundStudents, setFoundStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [nextFingerprintId, setNextFingerprintId] = useState<number>(1);
  const [statusMessage, setStatusMessage] = useState('');
  const [enrollmentCount, setEnrollmentCount] = useState(0);
  const [scanProgress, setScanProgress] = useState({ firstScan: false, secondScan: false });
  const [resettingAll, setResettingAll] = useState(false);
  const [verificationResult, setVerificationResult] = useState<any>(null);
  const [lastEnrolledStudent, setLastEnrolledStudent] = useState<Student | null>(null);

  // Fetch devices
  useEffect(() => {
    fetchDevices();
    const interval = setInterval(fetchDevices, 10000);
    return () => clearInterval(interval);
  }, []);

  // Fetch next fingerprint ID on mount
  useEffect(() => {
    fetchNextFingerprintId();
  }, []);

  const fetchDevices = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('fingerprint_devices')
        .select('*')
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
  }, [selectedDevice]);

  const fetchNextFingerprintId = useCallback(async () => {
    try {
      // Get max fingerprint ID from templates
      const { data, error } = await supabase
        .from('fingerprint_templates')
        .select('fingerprint_id')
        .order('fingerprint_id', { ascending: false })
        .limit(1);

      if (!error && data && data.length > 0) {
        setNextFingerprintId(data[0].fingerprint_id + 1);
      } else {
        setNextFingerprintId(1);
      }

      // Get enrollment count
      const { count } = await supabase
        .from('fingerprint_templates')
        .select('id', { count: 'exact' });

      setEnrollmentCount(count || 0);
    } catch (error) {
      console.error('Error fetching next fingerprint ID:', error);
      setNextFingerprintId(1);
    }
  }, []);

  // Reset all fingerprints function
  const resetAllFingerprints = async () => {
    const confirmed = window.confirm(
      '⚠️ WARNING: This will delete ALL fingerprint templates!\n\nThis action cannot be undone. Are you sure?'
    );

    if (!confirmed) return;

    const doubleConfirm = window.confirm(
      'This will permanently delete fingerprint data for ALL students.\n\nType "RESET" in the next dialog to confirm.'
    );

    if (!doubleConfirm) return;

    const resetCode = prompt('Type "RESET" to confirm deletion of all fingerprints:');
    if (resetCode !== 'RESET') {
      toast({
        title: 'Reset Cancelled',
        description: 'Fingerprint reset was cancelled',
      });
      return;
    }

    setResettingAll(true);
    try {
      // Delete all fingerprint templates
      const { error } = await supabase
        .from('fingerprint_templates')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all except dummy

      if (error) throw error;

      // Reset fingerprint ID counter
      setNextFingerprintId(1);
      setEnrollmentCount(0);

      toast({
        title: 'All Fingerprints Reset',
        description: 'All fingerprint templates have been deleted',
      });

      fetchNextFingerprintId();
    } catch (error) {
      console.error('Reset error:', error);
      toast({
        title: 'Reset Failed',
        description: 'Could not reset fingerprints. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setResettingAll(false);
    }
  };

  const isDeviceOnline = useCallback((device: FingerprintDevice): boolean => {
    if (!device.last_seen_at) return false;
    const lastSeen = new Date(device.last_seen_at);
    const now = new Date();
    return (now.getTime() - lastSeen.getTime()) / (1000 * 60) < 2;
  }, []);

  const getSelectedDevice = useCallback((): FingerprintDevice | undefined => {
    return devices.find((d) => d.device_code === selectedDevice);
  }, [devices, selectedDevice]);

  // Memoize computed values for better performance
  const selectedDeviceInfo = useMemo(() => {
    const device = getSelectedDevice();
    return {
      device,
      isOnline: device ? isDeviceOnline(device) : false
    };
  }, [getSelectedDevice, isDeviceOnline]);

  const startEnrollment = useCallback(() => {
    if (!selectedDevice) {
      toast({
        title: 'No Device Selected',
        description: 'Please select a fingerprint device first',
        variant: 'destructive',
      });
      return;
    }

    const { device, isOnline } = selectedDeviceInfo;
    if (!device || !isOnline) {
      toast({
        title: 'Device Offline',
        description: 'Selected device is not online. Check ESP32 Serial Monitor.',
        variant: 'destructive',
      });
      return;
    }

    // Start with student search first (simpler workflow)
    setEnrollmentStep('enter_student');
    setStatusMessage('Enter enrollment number or student name');
    setSearchQuery('');
    setFoundStudents([]);
    setSelectedStudent(null);
  }, [selectedDevice, selectedDeviceInfo]);

  const searchStudent = async () => {
    if (!searchQuery.trim()) {
      toast({
        title: 'Enter Search',
        description: 'Please enter enrollment number or student name',
        variant: 'destructive',
      });
      return;
    }

    setEnrollmentStep('searching');
    setStatusMessage('Searching for student...');

    try {
      // Search by enrollment number or name
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .eq('status', 'ACTIVE')
        .or(`enrollment_no.ilike.%${searchQuery}%,name.ilike.%${searchQuery}%`)
        .limit(10);

      if (error) throw error;

      if (!data || data.length === 0) {
        setEnrollmentStep('enter_student');
        setStatusMessage('No student found. Try different search term.');
        toast({
          title: 'Not Found',
          description: 'No student found with that enrollment number or name',
          variant: 'destructive',
        });
        return;
      }

      // Check which students already have fingerprints
      const studentIds = data.map(s => s.id);
      const { data: templates } = await supabase
        .from('fingerprint_templates')
        .select('student_id, fingerprint_id')
        .in('student_id', studentIds);

      const templateMap = new Map(templates?.map(t => [t.student_id, t.fingerprint_id]) || []);

      // Add fingerprint status
      const studentsWithStatus = data.map((s) => ({
        ...s,
        has_fingerprint: templateMap.has(s.id),
        fingerprint_id: templateMap.get(s.id),
      }));

      setFoundStudents(studentsWithStatus);

      if (studentsWithStatus.length === 1) {
        setSelectedStudent(studentsWithStatus[0]);
      }

      setEnrollmentStep('confirming');
      setStatusMessage(studentsWithStatus.length === 1 ? 'Confirm student and start scanning' : 'Select the correct student');
    } catch (error) {
      console.error('Search error:', error);
      setEnrollmentStep('enter_student');
      setStatusMessage('Search failed. Please try again.');
      toast({
        title: 'Error',
        description: 'Failed to search students',
        variant: 'destructive',
      });
    }
  };

  const confirmAndStartScanning = async () => {
    if (!selectedStudent) {
      toast({
        title: 'No Student Selected',
        description: 'Please select a student first',
        variant: 'destructive',
      });
      return;
    }

    if (selectedStudent.has_fingerprint) {
      const confirmOverwrite = window.confirm(
        `${selectedStudent.name} already has a fingerprint (ID: ${selectedStudent.fingerprint_id}). Do you want to replace it?`
      );
      if (!confirmOverwrite) {
        return;
      }
    }

    const device = getSelectedDevice();
    if (!device) {
      toast({
        title: 'Device Error',
        description: 'Selected device not found',
        variant: 'destructive',
      });
      return;
    }

    // Reset scan progress
    setScanProgress({ firstScan: false, secondScan: false });
    setEnrollmentStep('first_scan');

    // Get the fingerprint ID to use
    let fingerprintIdToUse = nextFingerprintId;
    if (selectedStudent.has_fingerprint && selectedStudent.fingerprint_id) {
      fingerprintIdToUse = selectedStudent.fingerprint_id;
    }

    setStatusMessage(`🖐️ First Scan: Place ${selectedStudent.name}'s finger on the sensor...\n\nFingerprint ID: ${fingerprintIdToUse}`);

    try {
      // Send enrollment command via edge function
      const { data: response, error } = await supabase.functions.invoke('device-api', {
        body: {
          device_code: selectedDevice,
          action: 'start_enrollment',
          fingerprint_id: fingerprintIdToUse,
          student_id: selectedStudent.id,
        },
      });

      if (error) {
        console.error('Edge function error:', error);
        // Continue anyway - device might pick up from queue
      }

      // Start polling for completion with optimized faster polling
      pollForEnrollmentComplete(fingerprintIdToUse);
    } catch (error) {
      console.error('Enrollment error:', error);
      // Continue with polling anyway
      pollForEnrollmentComplete(fingerprintIdToUse);
    }
  };

  const pollForEnrollmentComplete = (fingerprintId: number) => {
    let attempts = 0;
    const maxAttempts = 90; // 90 seconds max - enough time for slow scans
    let lastTemplateCheck = 0;
    const enrollmentStartTime = Date.now();

    // Transition to second scan phase after 10 seconds
    const phaseUpdateTimer = setTimeout(() => {
      if (enrollmentStep === 'first_scan') {
        setScanProgress(prev => ({ ...prev, firstScan: true }));
        setEnrollmentStep('second_scan');
        setStatusMessage(`🖐️ Good! Now LIFT finger, then place SAME finger again...`);
        toast({
          title: 'Ready for Second Scan',
          description: 'Lift finger, then place SAME finger again',
        });
      }
    }, 10000);

    const interval = setInterval(async () => {
      attempts++;

      try {
        // Check if ESP32 has created the template (REAL enrollment complete)
        // Only check every 2 seconds to reduce load
        if (Date.now() - lastTemplateCheck > 2000) {
          lastTemplateCheck = Date.now();

          const { data: templates, error } = await supabase
            .from('fingerprint_templates')
            .select('id, fingerprint_id, created_at')
            .eq('student_id', selectedStudent!.id)
            .limit(1);

          // If template found in database - ESP32 ACTUALLY completed enrollment!
          if (!error && templates && templates.length > 0) {
            // Verify the template was created recently (within last 2 minutes)
            const templateTime = new Date(templates[0].created_at).getTime();
            if (templateTime > enrollmentStartTime - 5000) {
              clearInterval(interval);
              clearTimeout(phaseUpdateTimer);
              setScanProgress({ firstScan: true, secondScan: true });
              enrollmentSuccess();
              return;
            }
          }
        }

        // Update status message to show progress
        if (attempts % 5 === 0) {
          const secondsLeft = maxAttempts - attempts;
          setStatusMessage(
            enrollmentStep === 'first_scan'
              ? `🖐️ Place finger on scanner... (${secondsLeft}s remaining)`
              : `🖐️ Place SAME finger again... (${secondsLeft}s remaining)`
          );
        }

        // After timeout - FAIL, don't auto-save!
        if (attempts >= maxAttempts) {
          clearInterval(interval);
          clearTimeout(phaseUpdateTimer);

          setEnrollmentStep('error');
          setScanProgress({ firstScan: false, secondScan: false });
          setStatusMessage(
            '❌ Enrollment failed. No fingerprint was saved by the device.\n\nMake sure to complete BOTH scans on the ESP32 device.'
          );

          toast({
            title: 'Enrollment Failed',
            description: 'Both scans must be completed on the device',
            variant: 'destructive',
          });
        }
      } catch (error) {
        // Continue polling
      }
    }, 1000);
  };

  const enrollmentSuccess = () => {
    setEnrollmentStep('success');
    setStatusMessage(`${selectedStudent!.name} enrolled successfully!`);
    setLastEnrolledStudent(selectedStudent);
    setEnrollmentCount(prev => prev + 1);
    fetchNextFingerprintId();

    toast({
      title: 'Success!',
      description: `${selectedStudent!.name} fingerprint enrolled`,
    });

    // Don't auto-reset - let user choose to test or enroll another
  };

  // REAL verification test function - actually tests fingerprint on device
  const testEnrolledFingerprint = async () => {
    if (!lastEnrolledStudent || !selectedDevice) return;

    setEnrollmentStep('verify');
    setStatusMessage(`🖐️ Place ${lastEnrolledStudent.name}'s finger on scanner NOW...`);
    setVerificationResult(null);

    // First check template exists
    const { data: template } = await supabase
      .from('fingerprint_templates')
      .select('id, fingerprint_id')
      .eq('student_id', lastEnrolledStudent.id)
      .limit(1);

    if (!template || template.length === 0) {
      setVerificationResult({
        success: false,
        message: 'No fingerprint template found. Please enroll first.'
      });
      setEnrollmentStep('verify_result');
      return;
    }

    const fingerprintId = template[0].fingerprint_id;
    const testStartTime = Date.now();
    let testId: string | null = null;

    toast({
      title: 'Test Started',
      description: `Place finger on scanner to verify (ID: ${fingerprintId})`,
    });

    // Send verify command to device via edge function
    try {
      const { data: verifyResponse } = await supabase.functions.invoke('device-api', {
        body: {
          device_code: selectedDevice,
          action: 'verify_fingerprint',
          fingerprint_id: fingerprintId,
          student_id: lastEnrolledStudent.id,
        },
      });
      testId = verifyResponse?.test_id;
    } catch (err) {
      console.log('Verify command error:', err);
    }

    // Poll for verification result
    let attempts = 0;
    const maxAttempts = 30; // 30 seconds for test

    const pollInterval = setInterval(async () => {
      attempts++;

      try {
        // Method 1: Check edge function for verify result (if test_id is available)
        if (testId) {
          const { data: resultData } = await supabase.functions.invoke('device-api', {
            body: {
              device_code: selectedDevice,
              action: 'get_verify_result',
              test_id: testId,
            },
          });

          if (resultData && !resultData.pending) {
            clearInterval(pollInterval);

            if (resultData.success && resultData.recognized_id === fingerprintId) {
              setVerificationResult({
                success: true,
                message: `✅ Fingerprint VERIFIED! Device recognized ${lastEnrolledStudent.name}'s fingerprint (ID: ${fingerprintId}).`
              });
              toast({
                title: '✅ Test Passed!',
                description: 'Fingerprint recognized by device',
              });
            } else if (resultData.recognized_id !== null && resultData.recognized_id !== fingerprintId) {
              setVerificationResult({
                success: false,
                message: `❌ Wrong fingerprint! Expected ID ${fingerprintId} but got ID ${resultData.recognized_id}`
              });
              toast({
                title: 'Test Failed',
                description: 'Different fingerprint recognized',
                variant: 'destructive',
              });
            } else {
              setVerificationResult({
                success: false,
                message: `❌ Fingerprint not recognized. Make sure to place the ENROLLED finger on the scanner.`
              });
              toast({
                title: 'Test Failed',
                description: 'Fingerprint not recognized',
                variant: 'destructive',
              });
            }
            setEnrollmentStep('verify_result');
            return;
          }
        }

        // Method 2: Check for recent attendance record created by fingerprint scan
        const { data: attendance } = await supabase
          .from('attendance_records')
          .select('id, created_at, student_id')
          .eq('student_id', lastEnrolledStudent.id)
          .gte('created_at', new Date(testStartTime - 5000).toISOString())
          .order('created_at', { ascending: false })
          .limit(1);

        if (attendance && attendance.length > 0) {
          // Fingerprint was ACTUALLY recognized by the device!
          clearInterval(pollInterval);
          setVerificationResult({
            success: true,
            message: `✅ Fingerprint VERIFIED! Device recognized ${lastEnrolledStudent.name}'s fingerprint.`
          });
          setEnrollmentStep('verify_result');

          toast({
            title: '✅ Test Passed!',
            description: 'Fingerprint recognized by device',
          });
          return;
        }

        // Update countdown
        const secondsLeft = maxAttempts - attempts;
        setStatusMessage(`🖐️ Place finger on scanner... (${secondsLeft}s remaining)`);

        // Timeout
        if (attempts >= maxAttempts) {
          clearInterval(pollInterval);
          setVerificationResult({
            success: false,
            message: `❌ Test failed. No fingerprint was detected on the device.\n\nMake sure to ACTUALLY place the enrolled finger on the scanner.`
          });
          setEnrollmentStep('verify_result');

          toast({
            title: 'Test Failed',
            description: 'No fingerprint detected - place finger on scanner',
            variant: 'destructive',
          });
        }
      } catch (error) {
        // Continue polling
      }
    }, 1000);
  };

  const resetEnrollment = () => {
    setEnrollmentStep('idle');
    setStatusMessage('');
    setSearchQuery('');
    setFoundStudents([]);
    setSelectedStudent(null);
    setScanProgress({ firstScan: false, secondScan: false });
    setVerificationResult(null);
    setLastEnrolledStudent(null);
  };

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
              Quick Enrollment
            </h1>
            <p className="text-muted-foreground mt-1">
              Find student first, then scan fingerprint twice
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={fetchDevices}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={resetAllFingerprints}
              disabled={resettingAll}
              className="bg-red-600 hover:bg-red-700"
            >
              {resettingAll ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              {resettingAll ? 'Resetting...' : 'Reset All'}
            </Button>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Enrolled Today</p>
              <p className="text-2xl font-bold text-primary">{enrollmentCount}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel - Device Selection */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="w-5 h-5" />
                Device Selection
              </CardTitle>
              <CardDescription>Select fingerprint scanner</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select value={selectedDevice} onValueChange={setSelectedDevice}>
                <SelectTrigger>
                  <SelectValue placeholder="Select device" />
                </SelectTrigger>
                <SelectContent>
                  {devices.map((device) => (
                    <SelectItem key={device.device_code} value={device.device_code}>
                      <div className="flex items-center gap-2">
                        {isDeviceOnline(device) ? (
                          <Wifi className="w-4 h-4 text-green-500" />
                        ) : (
                          <WifiOff className="w-4 h-4 text-gray-400" />
                        )}
                        <span>{device.device_name || device.device_code}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedDevice && (
                <div className="p-3 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-2">
                    {selectedDeviceInfo.isOnline ? (
                      <>
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                        <span className="text-sm text-green-600 font-medium">
                          Device Online
                        </span>
                      </>
                    ) : (
                      <>
                        <div className="w-2 h-2 bg-red-500 rounded-full" />
                        <span className="text-sm text-red-600 font-medium">
                          Device Offline
                        </span>
                      </>
                    )}
                  </div>
                </div>
              )}

              <div className="text-sm text-muted-foreground">
                <p><strong>Next ID:</strong> {nextFingerprintId}</p>
              </div>
            </CardContent>
          </Card>

          {/* Center Panel - Enrollment Process */}
          <Card className="glass-card lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Fingerprint className="w-5 h-5" />
                Enrollment Process
              </CardTitle>
              <CardDescription>Follow the steps below</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Step Indicator */}
                <div className="flex items-center justify-center gap-2 flex-wrap">
                  <div
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                      enrollmentStep === 'enter_student' || enrollmentStep === 'searching' || enrollmentStep === 'confirming'
                        ? 'bg-primary/20 text-primary border border-primary/50'
                        : 'bg-muted/50 text-muted-foreground'
                    }`}
                  >
                    <Search className="w-4 h-4" />
                    <span className="font-medium">1. Find</span>
                  </div>
                  <div className="w-6 h-0.5 bg-border hidden sm:block" />
                  <div
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                      enrollmentStep === 'first_scan' || (scanProgress.firstScan && !scanProgress.secondScan)
                        ? 'bg-blue-100 text-blue-700 border border-blue-300'
                        : scanProgress.firstScan
                        ? 'bg-green-100 text-green-700 border border-green-300'
                        : 'bg-muted/50 text-muted-foreground'
                    }`}
                  >
                    <Fingerprint className="w-4 h-4" />
                    <span className="font-medium">2. Scan 1</span>
                    {scanProgress.firstScan && <CheckCircle className="w-4 h-4 text-green-600" />}
                  </div>
                  <div className="w-6 h-0.5 bg-border hidden sm:block" />
                  <div
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                      enrollmentStep === 'second_scan'
                        ? 'bg-blue-100 text-blue-700 border border-blue-300'
                        : scanProgress.secondScan
                        ? 'bg-green-100 text-green-700 border border-green-300'
                        : 'bg-muted/50 text-muted-foreground'
                    }`}
                  >
                    <Fingerprint className="w-4 h-4" />
                    <span className="font-medium">3. Scan 2</span>
                    {scanProgress.secondScan && <CheckCircle className="w-4 h-4 text-green-600" />}
                  </div>
                  <div className="w-6 h-0.5 bg-border hidden sm:block" />
                  <div
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                      enrollmentStep === 'saving' || enrollmentStep === 'success'
                        ? 'bg-green-100 text-green-700 border border-green-300'
                        : 'bg-muted/50 text-muted-foreground'
                    }`}
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span className="font-medium">4. Save</span>
                  </div>
                </div>

                {/* Main Content Area */}
                <div className="min-h-[300px] flex flex-col items-center justify-center p-8">
                  <AnimatePresence mode="wait">
                    {/* Idle State */}
                    {enrollmentStep === 'idle' && (
                      <motion.div
                        key="idle"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="text-center space-y-6"
                      >
                        <Fingerprint className="w-24 h-24 mx-auto text-primary" />
                        <div>
                          <h3 className="text-xl font-bold mb-2">
                            Ready to Enroll
                          </h3>
                          <p className="text-muted-foreground">
                            Click Start to begin fingerprint enrollment
                          </p>
                        </div>
                        <Button
                          onClick={startEnrollment}
                          size="lg"
                          className="gap-2"
                          disabled={!selectedDevice || !selectedDeviceInfo.isOnline}
                        >
                          <Play className="w-5 h-5" />
                          Start Enrollment
                        </Button>
                      </motion.div>
                    )}

                    {/* Enter Student State */}
                    {enrollmentStep === 'enter_student' && (
                      <motion.div
                        key="enter_student"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="w-full max-w-md space-y-6"
                      >
                        <div className="text-center">
                          <Search className="w-16 h-16 mx-auto text-primary mb-4" />
                          <h3 className="text-xl font-bold mb-2">
                            Find Student
                          </h3>
                          <p className="text-muted-foreground">
                            {statusMessage}
                          </p>
                        </div>

                        <div className="space-y-3">
                          <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                            <Input
                              placeholder="Enter enrollment number or name..."
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && searchStudent()}
                              className="pl-10 text-lg bg-background"
                              autoFocus
                            />
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              onClick={resetEnrollment}
                              className="flex-1"
                            >
                              Cancel
                            </Button>
                            <Button
                              onClick={searchStudent}
                              className="flex-1 gap-2"
                            >
                              <Search className="w-5 h-5" />
                              Search
                            </Button>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {/* Searching State */}
                    {enrollmentStep === 'searching' && (
                      <motion.div
                        key="searching"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="text-center space-y-4"
                      >
                        <Loader2 className="w-16 h-16 mx-auto animate-spin text-primary" />
                        <p className="text-muted-foreground">{statusMessage}</p>
                      </motion.div>
                    )}

                    {/* Confirming State */}
                    {enrollmentStep === 'confirming' && (
                      <motion.div
                        key="confirming"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="w-full max-w-md space-y-4"
                      >
                        <div className="text-center mb-4">
                          <h3 className="text-xl font-bold">
                            {foundStudents.length === 1
                              ? 'Confirm Student'
                              : 'Select Student'}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {statusMessage}
                          </p>
                        </div>

                        <div className="space-y-2 max-h-[200px] overflow-y-auto">
                          {foundStudents.map((student) => (
                            <div
                              key={student.id}
                              onClick={() => setSelectedStudent(student)}
                              className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                                selectedStudent?.id === student.id
                                  ? 'border-primary bg-primary/10'
                                  : 'border-border hover:border-primary/50'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="font-bold">{student.name}</p>
                                  <p className="text-sm text-muted-foreground">
                                    Roll: {student.roll_no} • {student.enrollment_no}
                                  </p>
                                </div>
                                {student.has_fingerprint && (
                                  <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                                    ID: {student.fingerprint_id}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="flex gap-2 pt-4">
                          <Button
                            variant="outline"
                            onClick={() => setEnrollmentStep('enter_student')}
                            className="flex-1"
                          >
                            Back
                          </Button>
                          <Button
                            onClick={confirmAndStartScanning}
                            disabled={!selectedStudent}
                            className="flex-1"
                          >
                            <Fingerprint className="w-4 h-4 mr-2" />
                            Scan Fingerprint
                          </Button>
                        </div>
                      </motion.div>
                    )}

                    {/* First Scan State */}
                    {enrollmentStep === 'first_scan' && (
                      <motion.div
                        key="first_scan"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="text-center space-y-6"
                      >
                        <motion.div
                          animate={{
                            scale: [1, 1.15, 1],
                          }}
                          transition={{ repeat: Infinity, duration: 2 }}
                        >
                          <Fingerprint className="w-24 h-24 mx-auto text-blue-500" />
                        </motion.div>
                        <div>
                          <div className="flex items-center justify-center gap-2 mb-2">
                            <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                            <h3 className="text-xl font-bold text-blue-600">First Scan...</h3>
                          </div>
                          <p className="text-muted-foreground mb-3">
                            Student: <strong>{selectedStudent?.name}</strong>
                          </p>
                          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
                            <p className="text-blue-700 dark:text-blue-300 font-medium">
                              🖐️ Place finger on sensor for FIRST scan
                            </p>
                          </div>
                          <p className="text-xs text-muted-foreground whitespace-pre-line">
                            {statusMessage}
                          </p>
                        </div>
                        <Button variant="outline" onClick={resetEnrollment}>
                          Cancel
                        </Button>
                      </motion.div>
                    )}

                    {/* Second Scan State */}
                    {enrollmentStep === 'second_scan' && (
                      <motion.div
                        key="second_scan"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="text-center space-y-6"
                      >
                        <motion.div
                          animate={{
                            scale: [1, 1.1, 1],
                            rotate: [0, 5, -5, 0]
                          }}
                          transition={{ repeat: Infinity, duration: 1.8 }}
                        >
                          <Fingerprint className="w-24 h-24 mx-auto text-orange-500" />
                        </motion.div>
                        <div>
                          <div className="flex items-center justify-center gap-2 mb-2">
                            <CheckCircle className="w-5 h-5 text-green-500" />
                            <h3 className="text-xl font-bold text-orange-600">Second Scan...</h3>
                          </div>
                          <p className="text-muted-foreground mb-3">
                            Student: <strong>{selectedStudent?.name}</strong>
                          </p>
                          <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4 mb-4">
                            <div className="flex items-center justify-center gap-2 mb-2">
                              <CheckCircle className="w-5 h-5 text-green-600" />
                              <p className="text-green-700 dark:text-green-300 font-medium">First scan completed!</p>
                            </div>
                            <p className="text-orange-700 dark:text-orange-300 font-medium">
                              🖐️ Place the SAME finger again for verification
                            </p>
                          </div>
                          <p className="text-xs text-muted-foreground whitespace-pre-line">
                            {statusMessage}
                          </p>
                        </div>
                        <Button variant="outline" onClick={resetEnrollment}>
                          Cancel
                        </Button>
                      </motion.div>
                    )}

                    {/* Saving State */}
                    {enrollmentStep === 'saving' && (
                      <motion.div
                        key="saving"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="text-center space-y-4"
                      >
                        <Loader2 className="w-16 h-16 mx-auto animate-spin text-primary" />
                        <p className="text-muted-foreground">{statusMessage}</p>
                      </motion.div>
                    )}

                    {/* Success State */}
                    {enrollmentStep === 'success' && (
                      <motion.div
                        key="success"
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.5 }}
                        className="text-center space-y-6"
                      >
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: 'spring', stiffness: 200 }}
                        >
                          <CheckCircle className="w-24 h-24 mx-auto text-green-500" />
                        </motion.div>
                        <div>
                          <h3 className="text-2xl font-bold text-green-600 mb-2">
                            Enrollment Complete!
                          </h3>
                          <p className="text-muted-foreground">{statusMessage}</p>
                          <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                            <p className="text-green-700 dark:text-green-300 font-medium text-sm">
                              💡 Test the fingerprint to make sure it works correctly
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-3">
                          <Button onClick={testEnrolledFingerprint} className="flex-1 bg-blue-600 hover:bg-blue-700">
                            <Fingerprint className="w-4 h-4 mr-2" />
                            Test Fingerprint
                          </Button>
                          <Button onClick={resetEnrollment} variant="outline" className="flex-1">
                            <RotateCcw className="w-4 h-4 mr-2" />
                            Enroll Another
                          </Button>
                        </div>
                      </motion.div>
                    )}

                    {/* Verify State */}
                    {enrollmentStep === 'verify' && (
                      <motion.div
                        key="verify"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="text-center space-y-6"
                      >
                        <motion.div
                          animate={{
                            scale: [1, 1.1, 1],
                            rotate: [0, 10, -10, 0]
                          }}
                          transition={{ repeat: Infinity, duration: 2 }}
                        >
                          <Fingerprint className="w-24 h-24 mx-auto text-blue-500" />
                        </motion.div>
                        <div>
                          <div className="flex items-center justify-center gap-2 mb-2">
                            <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                            <h3 className="text-xl font-bold text-blue-600">Testing Fingerprint...</h3>
                          </div>
                          <p className="text-muted-foreground mb-3">
                            Student: <strong>{lastEnrolledStudent?.name}</strong>
                          </p>
                          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
                            <p className="text-blue-700 dark:text-blue-300 font-medium">
                              🖐️ Place finger on sensor to verify it works
                            </p>
                          </div>
                          <p className="text-xs text-muted-foreground whitespace-pre-line">
                            {statusMessage}
                          </p>
                        </div>
                        <Button variant="outline" onClick={() => setEnrollmentStep('success')}>
                          Cancel Test
                        </Button>
                      </motion.div>
                    )}

                    {/* Verify Result State */}
                    {enrollmentStep === 'verify_result' && (
                      <motion.div
                        key="verify_result"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="text-center space-y-6"
                      >
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: 'spring', stiffness: 200 }}
                        >
                          {verificationResult?.success ? (
                            <CheckCircle className="w-24 h-24 mx-auto text-green-500" />
                          ) : (
                            <AlertTriangle className="w-24 h-24 mx-auto text-orange-500" />
                          )}
                        </motion.div>
                        <div>
                          <h3 className={`text-2xl font-bold mb-2 ${verificationResult?.success ? 'text-green-600' : 'text-orange-600'}`}>
                            {verificationResult?.success ? 'Test Passed!' : 'Test Issue'}
                          </h3>
                          <p className="text-muted-foreground">{verificationResult?.message}</p>
                        </div>
                        <div className="flex gap-3">
                          {!verificationResult?.success && (
                            <Button onClick={testEnrolledFingerprint} className="flex-1 bg-blue-600 hover:bg-blue-700">
                              <Fingerprint className="w-4 h-4 mr-2" />
                              Test Again
                            </Button>
                          )}
                          <Button onClick={resetEnrollment} variant="outline" className="flex-1">
                            <RotateCcw className="w-4 h-4 mr-2" />
                            Enroll Another
                          </Button>
                        </div>
                      </motion.div>
                    )}

                    {/* Error State */}
                    {enrollmentStep === 'error' && (
                      <motion.div
                        key="error"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="text-center space-y-6"
                      >
                        <AlertCircle className="w-24 h-24 mx-auto text-red-500" />
                        <div>
                          <h3 className="text-xl font-bold text-red-600 mb-2">
                            Error
                          </h3>
                          <p className="text-muted-foreground">{statusMessage}</p>
                        </div>
                        <Button onClick={resetEnrollment} variant="outline">
                          <RotateCcw className="w-4 h-4 mr-2" />
                          Try Again
                        </Button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </motion.div>
    </PageShell>
  );
};

export default QuickEnrollment;
