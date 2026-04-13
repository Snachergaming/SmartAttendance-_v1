import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Fingerprint, Play, CheckCircle, Loader2 } from 'lucide-react';
import PageShell from '@/components/layout/PageShell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const EnrollmentSimulatorPage: React.FC = () => {
  const [simulationStep, setSimulationStep] = useState<'idle' | 'first_scan' | 'second_scan' | 'success'>('idle');
  const [progress, setProgress] = useState({ firstScan: false, secondScan: false });

  const simulateEnrollment = async () => {
    setSimulationStep('first_scan');
    setProgress({ firstScan: false, secondScan: false });

    // Simulate first scan after 2 seconds
    setTimeout(() => {
      setProgress(prev => ({ ...prev, firstScan: true }));
      setSimulationStep('second_scan');

      toast({
        title: 'First Scan Complete!',
        description: 'Please scan the same finger again',
      });

      // Simulate second scan after another 3 seconds
      setTimeout(() => {
        setProgress(prev => ({ ...prev, secondScan: true }));
        setSimulationStep('success');

        toast({
          title: 'Enrollment Complete!',
          description: 'Fingerprint enrolled successfully',
        });

        // Reset after 3 seconds
        setTimeout(() => {
          setSimulationStep('idle');
          setProgress({ firstScan: false, secondScan: false });
        }, 3000);
      }, 3000);
    }, 2000);
  };

  return (
    <PageShell role="admin">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">
            🧪 Enrollment Simulator
          </h1>
          <p className="text-muted-foreground mt-1">
            Test the two-stage fingerprint enrollment process
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Progress Steps */}
          <Card className="glass-card border-border/50">
            <CardHeader>
              <CardTitle>Enrollment Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className={`flex items-center gap-3 p-3 rounded-lg ${simulationStep === 'first_scan' || progress.firstScan
                    ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                    : 'bg-muted/50 text-muted-foreground'
                  }`}>
                  {progress.firstScan ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : simulationStep === 'first_scan' ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Fingerprint className="w-5 h-5" />
                  )}
                  <span className="font-medium">First Fingerprint Scan</span>
                </div>

                <div className={`flex items-center gap-3 p-3 rounded-lg ${simulationStep === 'second_scan' || progress.secondScan
                    ? 'bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300'
                    : 'bg-muted/50 text-muted-foreground'
                  }`}>
                  {progress.secondScan ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : simulationStep === 'second_scan' ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Fingerprint className="w-5 h-5" />
                  )}
                  <span className="font-medium">Second Fingerprint Scan (Verification)</span>
                </div>

                <div className={`flex items-center gap-3 p-3 rounded-lg ${simulationStep === 'success'
                    ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                    : 'bg-muted/50 text-muted-foreground'
                  }`}>
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-medium">Save to Database</span>
                </div>
              </div>

              <Button
                onClick={simulateEnrollment}
                disabled={simulationStep !== 'idle'}
                className="w-full mt-6"
              >
                {simulationStep === 'idle' ? (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Start Simulation
                  </>
                ) : (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Simulation Display */}
          <Card className="glass-card border-border/50">
            <CardHeader>
              <CardTitle>Fingerprint Scanner</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-center py-16">
              {simulationStep === 'idle' && (
                <div className="text-center space-y-4">
                  <Fingerprint className="w-24 h-24 mx-auto text-muted-foreground/50" />
                  <p className="text-muted-foreground">Ready to scan</p>
                </div>
              )}

              {simulationStep === 'first_scan' && (
                <motion.div
                  className="text-center space-y-4"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                >
                  <motion.div
                    animate={{
                      scale: [1, 1.1, 1],
                    }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                  >
                    <Fingerprint className="w-24 h-24 mx-auto text-blue-500" />
                  </motion.div>
                  <p className="text-blue-600 font-medium">First Scan in Progress...</p>
                </motion.div>
              )}

              {simulationStep === 'second_scan' && (
                <motion.div
                  className="text-center space-y-4"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                >
                  <motion.div
                    animate={{
                      scale: [1, 1.05, 1],
                      rotate: [0, 2, -2, 0]
                    }}
                    transition={{ repeat: Infinity, duration: 1.2 }}
                  >
                    <Fingerprint className="w-24 h-24 mx-auto text-orange-500" />
                  </motion.div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <span className="text-green-600 text-sm">First scan completed</span>
                    </div>
                    <p className="text-orange-600 font-medium">Verification Scan...</p>
                  </div>
                </motion.div>
              )}

              {simulationStep === 'success' && (
                <motion.div
                  className="text-center space-y-4"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                >
                  <CheckCircle className="w-24 h-24 mx-auto text-green-500" />
                  <p className="text-green-600 font-bold text-lg">Enrollment Complete!</p>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <div className="flex items-center justify-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span>First scan: ✓</span>
                    </div>
                    <div className="flex items-center justify-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span>Second scan: ✓</span>
                    </div>
                    <div className="flex items-center justify-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span>Saved to database: ✓</span>
                    </div>
                  </div>
                </motion.div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="glass-card border-border/50">
          <CardHeader>
            <CardTitle>How Two-Stage Enrollment Works</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">1</div>
              <div>
                <p className="font-medium text-blue-700">First Scan</p>
                <p className="text-muted-foreground">Student places finger on sensor. System captures initial fingerprint data.</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center font-bold text-xs">2</div>
              <div>
                <p className="font-medium text-orange-700">Second Scan (Verification)</p>
                <p className="text-muted-foreground">Student places the SAME finger again. System compares both scans for accuracy.</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-green-100 text-green-700 flex items-center justify-center font-bold text-xs">3</div>
              <div>
                <p className="font-medium text-green-700">Save Template</p>
                <p className="text-muted-foreground">If both scans match, create and save the fingerprint template to database.</p>
              </div>
            </div>

            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-blue-700 dark:text-blue-300 text-xs">
                <strong>Why Two Scans?</strong> Two-stage enrollment ensures higher accuracy by comparing two captures of the same finger, reducing false positives during attendance verification.
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </PageShell>
  );
};

export default EnrollmentSimulatorPage;