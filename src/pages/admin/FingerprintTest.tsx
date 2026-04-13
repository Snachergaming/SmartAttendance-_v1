import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Fingerprint, Send, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import PageShell from '@/components/layout/PageShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';

const FingerprintTestPage: React.FC = () => {
  const [deviceCode, setDeviceCode] = useState('TEST_DEVICE_01');
  const [fingerprintId, setFingerprintId] = useState('1');
  const [testing, setTesting] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);

  const handleTestScan = async () => {
    if (!deviceCode || !fingerprintId) {
      toast({
        title: 'Missing Data',
        description: 'Please enter device code and fingerprint ID',
        variant: 'destructive'
      });
      return;
    }

    setTesting(true);
    setLastResult(null);

    try {
      console.log('🧪 Testing fingerprint scan:', { deviceCode, fingerprintId });

      // Simulate ESP32 request to edge function
      const response = await fetch('/functions/v1/device-api', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          device_code: deviceCode,
          action: 'attendance_scan',
          fingerprint_id: parseInt(fingerprintId)
        })
      });

      const result = await response.json();
      console.log('📡 Server response:', result);

      setLastResult(result);

      if (result.success) {
        toast({
          title: '✅ Success!',
          description: result.show_message || result.message,
        });
      } else {
        toast({
          title: '❌ Failed',
          description: result.show_message || result.error,
          variant: 'destructive'
        });
      }

    } catch (error) {
      console.error('❌ Test error:', error);
      toast({
        title: 'Test Failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <PageShell role="admin">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">
            🧪 Fingerprint Test Tool
          </h1>
          <p className="text-muted-foreground mt-1">
            Test fingerprint scanning functionality without physical device
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Test Input */}
          <Card className="glass-card border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Fingerprint className="w-5 h-5" />
                Simulate Fingerprint Scan
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="deviceCode">Device Code</Label>
                <Input
                  id="deviceCode"
                  value={deviceCode}
                  onChange={(e) => setDeviceCode(e.target.value)}
                  placeholder="e.g., TEST_DEVICE_01"
                  className="bg-background/50 border-border/50"
                />
              </div>

              <div>
                <Label htmlFor="fingerprintId">Fingerprint ID</Label>
                <Input
                  id="fingerprintId"
                  type="number"
                  value={fingerprintId}
                  onChange={(e) => setFingerprintId(e.target.value)}
                  placeholder="1, 2, 3, 4, 5..."
                  className="bg-background/50 border-border/50"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Use IDs 1-5 for test students (John Doe=1, Jane Smith=2, etc.)
                </p>
              </div>

              <Button
                onClick={handleTestScan}
                disabled={testing}
                className="w-full btn-gradient"
              >
                {testing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                    Testing...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Test Fingerprint Scan
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Test Result */}
          <Card className="glass-card border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                📊 Test Result
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!lastResult ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Fingerprint className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p>Run a test to see results</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className={`flex items-center gap-2 p-3 rounded-lg ${lastResult.success
                      ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                      : 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                    }`}>
                    {lastResult.success ? (
                      <CheckCircle className="w-5 h-5" />
                    ) : (
                      <XCircle className="w-5 h-5" />
                    )}
                    <span className="font-medium">
                      {lastResult.success ? 'SUCCESS' : 'FAILED'}
                    </span>
                  </div>

                  <div className="space-y-2 text-sm">
                    {lastResult.student_name && (
                      <div>
                        <strong>Student:</strong> {lastResult.student_name}
                      </div>
                    )}
                    {lastResult.roll_no && (
                      <div>
                        <strong>Roll No:</strong> {lastResult.roll_no}
                      </div>
                    )}
                    {lastResult.status && (
                      <div>
                        <strong>Status:</strong> {lastResult.status}
                      </div>
                    )}
                    <div>
                      <strong>Message:</strong> {lastResult.show_message || lastResult.message || lastResult.error}
                    </div>
                  </div>

                  <details className="text-xs">
                    <summary className="cursor-pointer text-muted-foreground">Raw Response</summary>
                    <pre className="mt-2 p-2 bg-background/50 rounded overflow-auto">
                      {JSON.stringify(lastResult, null, 2)}
                    </pre>
                  </details>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Instructions */}
        <Card className="glass-card border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              Testing Instructions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="space-y-1">
              <p><strong>1. Setup Test Data:</strong> Run the sample_test_data.sql script in Supabase</p>
              <p><strong>2. Configure Device:</strong> Go to /admin/devices and configure TEST_DEVICE_01</p>
              <p><strong>3. Test Scans:</strong> Use fingerprint IDs 1-5 to test different students</p>
              <p><strong>4. Check Results:</strong> View real-time updates in /admin/live-attendance</p>
            </div>
            <div className="pt-2 border-t border-border/50">
              <p className="font-medium mb-1">Test Fingerprint Mappings:</p>
              <ul className="space-y-0.5 ml-4">
                <li>• Fingerprint ID 1 = John Doe (Roll 1)</li>
                <li>• Fingerprint ID 2 = Jane Smith (Roll 2)</li>
                <li>• Fingerprint ID 3 = Bob Johnson (Roll 3)</li>
                <li>• Fingerprint ID 4 = Alice Brown (Roll 4)</li>
                <li>• Fingerprint ID 5 = Charlie Wilson (Roll 5)</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </PageShell>
  );
};

export default FingerprintTestPage;