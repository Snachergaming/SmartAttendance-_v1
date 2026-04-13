import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Download, Upload, Search, UserCog, MoreVertical, Plus, RefreshCw } from 'lucide-react';
import PageShell from '@/components/layout/PageShell';
import DataTable from '@/components/ui/DataTable';
import StatusBadge from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { getFaculty, updateFaculty, updateFacultyPassword, updateFacultyPasswordsToMobile, type Faculty } from '@/services/faculty';
import { supabase, SUPABASE_ANON_KEY } from '@/integrations/supabase/client';
import { downloadTemplate } from '@/utils/export';

const AdminFacultyPage: React.FC = () => {
  const [faculty, setFaculty] = useState<Faculty[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUpdatingPasswords, setIsUpdatingPasswords] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [selectedFaculty, setSelectedFaculty] = useState<Faculty | null>(null);
  const [passwordInput, setPasswordInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newFaculty, setNewFaculty] = useState({
    name: '',
    email: '',
    password: '',
    designation: '',
    employee_code: '',
  });

  const fetchFaculty = async () => {
    try {
      const data = await getFaculty();
      setFaculty(data);
    } catch (error: unknown) {
      console.error('Error fetching faculty:', error);
      const message = error instanceof Error ? error.message : 'Failed to load faculty';
      
      // Only redirect on JWT/auth errors
      if (message.includes('Invalid JWT') || message.includes('Missing authorization') || message.includes('expired')) {
        toast({
          title: 'Session Expired',
          description: 'Please log in again.',
          variant: 'destructive',
        });
        // Clear bad session and redirect
        await supabase.auth.signOut().catch(() => {});
        localStorage.clear();
        setTimeout(() => {
          window.location.href = '/login/admin';
        }, 1000);
      } else {
        toast({ title: 'Error', description: message, variant: 'destructive' });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFaculty();
  }, []);

  const filteredFaculty = faculty.filter((f) => {
    return (
      f.profiles?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.employee_code?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const handleAddFaculty = async () => {
    if (!newFaculty.name || !newFaculty.email || !newFaculty.password) {
      toast({ title: 'Error', description: 'Name, email and password are required', variant: 'destructive' });
      return;
    }

    if (newFaculty.password.length < 6) {
      toast({ title: 'Error', description: 'Password must be at least 6 characters', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await supabase.functions.invoke('create-faculty', {
        body: JSON.stringify({
          name: newFaculty.name,
          email: newFaculty.email,
          password: newFaculty.password,
          employee_code: newFaculty.employee_code,
          designation: newFaculty.designation,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.error) {
        let message = response.error instanceof Error ? response.error.message : 'Edge Function returned a non-2xx status code';

        if (response.response) {
          try {
            const body = await response.response.json();
            if (body?.error) {
              message = body.error;
            } else if (body?.message) {
              message = body.message;
            }
          } catch {
            // Ignore JSON parse errors from the response body
          }
        }

        throw new Error(message);
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      toast({ title: 'Success', description: `Faculty added. Login: ${newFaculty.email}` });
      setIsAddDialogOpen(false);
      setNewFaculty({ name: '', email: '', password: '', designation: '', employee_code: '' });
      fetchFaculty();
    } catch (error: unknown) {
      console.error('Error adding faculty:', error);
      const message = error instanceof Error ? error.message : 'Failed to add faculty';
      toast({
        title: 'Error',
        description: message.includes('Failed to send a request to the Edge Function')
          ? 'Unable to reach create-faculty edge function. Deploy it using Supabase CLI or check your project URL.'
          : message,
        variant: 'destructive'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    try {
      await updateFaculty(id, { status: currentStatus === 'Active' ? 'Inactive' : 'Active' });
      toast({ title: 'Success', description: 'Status updated' });
      fetchFaculty();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to update status', variant: 'destructive' });
    }
  };

  const openPasswordDialog = (faculty: Faculty) => {
    setSelectedFaculty(faculty);
    setPasswordInput('');
    setPasswordDialogOpen(true);
  };

  const handleChangePassword = async () => {
    if (!selectedFaculty?.profile_id) {
      toast({ title: 'Error', description: 'Unable to update password: missing profile', variant: 'destructive' });
      return;
    }

    if (!passwordInput || passwordInput.length < 6) {
      toast({ title: 'Error', description: 'Password must be at least 6 characters', variant: 'destructive' });
      return;
    }

    setIsChangingPassword(true);
    try {
      await updateFacultyPassword(selectedFaculty.profile_id, passwordInput);
      toast({ title: 'Success', description: `Password updated for ${selectedFaculty.profiles?.name || 'faculty'}` });
      setPasswordDialogOpen(false);
      fetchFaculty();
    } catch (error: unknown) {
      console.error('Error changing faculty password:', error);
      const message = error instanceof Error ? error.message : 'Failed to update password';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split('\n').filter(line => line.trim());
        // Parse headers carefully - remove quotes first
        const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());

        const nameIdx = headers.indexOf('name');
        const emailIdx = headers.indexOf('email');
        const mobileIdx = headers.indexOf('mobile');
        const empCodeIdx = headers.indexOf('employee_code');
        const designationIdx = headers.indexOf('designation');

        if (nameIdx === -1 || emailIdx === -1 || mobileIdx === -1) {
          toast({ title: 'Error', description: 'CSV must have name, email, and mobile columns', variant: 'destructive' });
          return;
        }

        let success = 0;
        let failed = 0;

        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
          try {
            const response = await supabase.functions.invoke('create-faculty', {
              body: JSON.stringify({
                name: values[nameIdx],
                email: values[emailIdx],
                password: values[mobileIdx], // Use mobile number as password
                mobile: values[mobileIdx],
                employee_code: empCodeIdx !== -1 ? values[empCodeIdx] : null,
                designation: designationIdx !== -1 ? values[designationIdx] : null,
              }),
              headers: {
                'Content-Type': 'application/json',
              },
            });

            if (response.error) {
              let message = response.error instanceof Error ? response.error.message : 'Edge Function returned a non-2xx status code';
              if (response.response) {
                try {
                  const body = await response.response.json();
                  if (body?.error) {
                    message = body.error;
                  } else if (body?.message) {
                    message = body.message;
                  }
                } catch {
                  // Ignore JSON parse errors from the response body
                }
              }
              throw new Error(message);
            }
            success++;
          } catch (error: unknown) {
            if (error instanceof Error && error.message.includes('Failed to send a request to the Edge Function')) {
              console.error('Edge function request failed during faculty CSV import:', error);
            }
            console.error('Faculty CSV import error:', error);
            failed++;
          }
        }

        toast({ title: 'Import Complete', description: `${success} added, ${failed} failed` });
        // Small delay to allow DB to process
        setTimeout(() => {
          fetchFaculty();
        }, 1000);
      } catch (error) {
        console.error('CSV parsing error:', error);
        toast({ title: 'Error', description: 'Failed to parse CSV file. Ensure proper format.', variant: 'destructive' });
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleBulkUpdatePasswords = async () => {
    const confirmed = window.confirm(
      '⚠️ This will update ALL faculty passwords to match their mobile numbers.\n\n' +
      'Are you sure you want to proceed? This action cannot be undone.'
    );

    if (!confirmed) return;

    setIsUpdatingPasswords(true);
    try {
      const result = await updateFacultyPasswordsToMobile();

      if (result.success > 0) {
        toast({
          title: 'Password Update Complete',
          description: result.message,
        });
      } else {
        toast({
          title: 'No Updates Needed',
          description: result.message,
          variant: 'destructive',
        });
      }
    } catch (error: unknown) {
      console.error('Error updating passwords:', error);
      const message = error instanceof Error ? error.message : 'Failed to update passwords';
      toast({
        title: 'Update Failed',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsUpdatingPasswords(false);
    }
  };

  const columns = [
    {
      key: 'name',
      header: 'Name',
      render: (f: Faculty) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
            <UserCog className="w-4 h-4 text-primary" />
          </div>
          <div>
            <span className="font-medium text-foreground block">{f.profiles?.name || 'N/A'}</span>
            <span className="text-xs text-muted-foreground">{f.employee_code || ''}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'account',
      header: 'Account',
      render: (f: Faculty) => (
        <StatusBadge variant={f.profile_id ? 'success' : 'danger'}>
          {f.profile_id ? 'Created' : 'Pending'}
        </StatusBadge>
      )
    },
    { key: 'designation', header: 'Designation', render: (f: Faculty) => f.designation || '-' },
    {
      key: 'status',
      header: 'Status',
      render: (f: Faculty) => (
        <StatusBadge variant={f.status === 'Active' ? 'success' : 'danger'}>
          {f.status}
        </StatusBadge>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (f: Faculty) => (
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => openPasswordDialog(f)}
            className="text-muted-foreground hover:text-foreground"
          >
            Change Password
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleToggleStatus(f.id, f.status)}
            className="text-muted-foreground hover:text-foreground"
            aria-label={`Toggle status for ${f.profiles?.name || 'faculty'}`}
          >
            <MoreVertical className="w-4 h-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <PageShell role="admin">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">
              Faculty Management
            </h1>
            <p className="text-muted-foreground mt-1">Manage Smart Attendance faculty members</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => downloadTemplate('faculty')}>
              <Download className="w-4 h-4 mr-2" />
              Template
            </Button>
            <Button variant="outline" size="sm" onClick={fetchFaculty} disabled={loading} aria-label="Refresh faculty list">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleImportCSV}
            />
            <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
              <Upload className="w-4 h-4 mr-2" />
              Import CSV
            </Button>
            <Button
              variant="outline"
              onClick={handleBulkUpdatePasswords}
              disabled={isUpdatingPasswords}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isUpdatingPasswords ? 'animate-spin' : ''}`} />
              {isUpdatingPasswords ? 'Updating...' : 'Update Passwords'}
            </Button>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button className="btn-gradient">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Faculty
                </Button>
              </DialogTrigger>
              <DialogContent className="glass-card border-border/50">
                <DialogHeader>
                  <DialogTitle>Add New Faculty</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div>
                    <Label>Name *</Label>
                    <Input
                      value={newFaculty.name}
                      onChange={(e) => setNewFaculty({ ...newFaculty, name: e.target.value })}
                      placeholder="Full name"
                      className="bg-muted/50 border-border/50"
                    />
                  </div>
                  <div>
                    <Label>Email (Login ID) *</Label>
                    <Input
                      type="email"
                      value={newFaculty.email}
                      onChange={(e) => setNewFaculty({ ...newFaculty, email: e.target.value })}
                        placeholder="faculty@ritppune.com"
                      className="bg-muted/50 border-border/50"
                    />
                  </div>
                  <div>
                    <Label>Password *</Label>
                    <Input
                      type="password"
                      value={newFaculty.password}
                      onChange={(e) => setNewFaculty({ ...newFaculty, password: e.target.value })}
                      placeholder="Min 6 characters"
                      className="bg-muted/50 border-border/50"
                    />
                  </div>
                  <div>
                    <Label>Employee Code</Label>
                    <Input
                      value={newFaculty.employee_code}
                      onChange={(e) => setNewFaculty({ ...newFaculty, employee_code: e.target.value })}
                      placeholder="EMP001"
                      className="bg-muted/50 border-border/50"
                    />
                  </div>
                  <div>
                    <Label>Designation</Label>
                    <Input
                      value={newFaculty.designation}
                      onChange={(e) => setNewFaculty({ ...newFaculty, designation: e.target.value })}
                      placeholder="Assistant Professor"
                      className="bg-muted/50 border-border/50"
                    />
                  </div>
                  <Button
                    onClick={handleAddFaculty}
                    className="w-full btn-gradient"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Adding...' : 'Add Faculty'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
            <DialogContent className="glass-card border-border/50">
              <DialogHeader>
                <DialogTitle>Change Faculty Password</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <Label>Faculty</Label>
                  <Input
                    value={selectedFaculty?.profiles?.name || ''}
                    disabled
                    className="bg-muted/50 border-border/50"
                  />
                </div>
                <div>
                  <Label>New Password *</Label>
                  <Input
                    type="password"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="Enter new password"
                    className="bg-muted/50 border-border/50"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleChangePassword}
                    className="btn-gradient"
                    disabled={isChangingPassword}
                  >
                    {isChangingPassword ? 'Saving...' : 'Update Password'}
                  </Button>
                  <Button variant="outline" onClick={() => setPasswordDialogOpen(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or employee code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-muted/50 border-border/50"
            />
          </div>
        </div>

        {/* Table */}
        <DataTable
          columns={columns}
          data={filteredFaculty}
          keyExtractor={(f) => f.id}
          isLoading={loading}
          emptyMessage="No faculty members found"
        />
      </motion.div>
    </PageShell>
  );
};

export default AdminFacultyPage;
