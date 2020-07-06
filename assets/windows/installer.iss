; ------------------------------------------
; Installer for Betaflight Blackbox Viewer
; ------------------------------------------
; It receives from the command line with /D the parameters: 
; version
; archName
; archAllowed
; archInstallIn64bit
; sourceFolder
; targetFolder

#define ApplicationName "Betaflight Blackbox Explorer"
#define CompanyName "The Betaflight open source project"
#define CompanyUrl "https://betaflight.com/"
#define ExecutableFileName "betaflight-blackbox-explorer.exe"
#define GroupName "Betaflight"
#define InstallerFileName "betaflight-blackbox-explorer-installer_" + version + "_" + archName
#define SourcePath "..\..\" + sourceFolder + "\betaflight-blackbox-explorer\" + archName
#define TargetFolderName "Betaflight-Blackbox-Explorer"
#define UpdatesUrl "https://github.com/betaflight/blackbox-log-viewer/releases/"

[CustomMessages]
LaunchProgram=Start %1

[Files]
Source: "{#SourcePath}\*"; DestDir: "{app}"; Flags: recursesubdirs

[Icons]
; Programs group
Name: "{group}\{#ApplicationName}"; Filename: "{app}\{#ExecutableFileName}";
; Desktop icon
Name: "{autodesktop}\{#ApplicationName}"; Filename: "{app}\{#ExecutableFileName}"; 
; Non admin users, uninstall icon
Name: "{group}\Uninstall {#ApplicationName}"; Filename: "{uninstallexe}"; Check: not IsAdminInstallMode

[Registry]
; File associations
Root: HKA; Subkey: "Software\Classes\.bbl"; ValueType: string; ValueName: ""; ValueData: "BetaflightBblFile"; Flags: uninsdeletevalue
Root: HKA; Subkey: "Software\Classes\BetaflightBblFile"; ValueType: string; ValueName: ""; ValueData: "Betaflight Blackbox Explorer log file"; Flags: uninsdeletekey
Root: HKA; Subkey: "Software\Classes\BetaflightBblFile\DefaultIcon"; ValueType: string; ValueName: ""; ValueData: "{app}\{#ExecutableFileName}"
Root: HKA; Subkey: "Software\Classes\BetaflightBblFile\shell\open\command"; ValueType: string; ValueName: ""; ValueData: """{app}\{#ExecutableFileName}"" ""%1"""

Root: HKA; Subkey: "Software\Classes\.bfl"; ValueType: string; ValueName: ""; ValueData: "BetaflightBflFile"; Flags: uninsdeletevalue
Root: HKA; Subkey: "Software\Classes\BetaflightBflFile"; ValueType: string; ValueName: ""; ValueData: "Blackbox Explorer log file"; Flags: uninsdeletekey
Root: HKA; Subkey: "Software\Classes\BetaflightBflFile\DefaultIcon"; ValueType: string; ValueName: ""; ValueData: "{app}\{#ExecutableFileName}"
Root: HKA; Subkey: "Software\Classes\BetaflightBflFile\shell\open\command"; ValueType: string; ValueName: ""; ValueData: """{app}\{#ExecutableFileName}"" ""%1"""

[Run]
; Add a checkbox to start the app after installed
Filename: {app}\{#ExecutableFileName}; Description: {cm:LaunchProgram, {#ApplicationName}}; Flags: nowait postinstall skipifsilent

[Setup]
AppId=610b3d74-ca89-4533-9490-128c40143493
AppName={#ApplicationName}
AppPublisher={#CompanyName}
AppPublisherURL={#CompanyUrl}
AppUpdatesURL={#UpdatesUrl}
AppVersion={#version}
ArchitecturesAllowed={#archAllowed}
ArchitecturesInstallIn64BitMode={#archInstallIn64bit}
ChangesAssociations=True
Compression=lzma2
DefaultDirName={autopf}\{#GroupName}\{#TargetFolderName}
DefaultGroupName={#GroupName}\{#ApplicationName}
LicenseFile=..\..\LICENSE
OutputBaseFilename={#InstallerFileName}
OutputDir=..\..\{#targetFolder}\
PrivilegesRequiredOverridesAllowed=commandline dialog
SetupIconFile=bf_installer_icon.ico
SolidCompression=yes
UninstallDisplayIcon={app}\{#ExecutableFileName}
UninstallDisplayName={#ApplicationName}
WizardImageFile=bf_installer.bmp
WizardSmallImageFile=bf_installer_small.bmp
WizardStyle=modern

[Code]
function InitializeSetup(): Boolean;
var
    ResultCode: Integer;
    ResultStr: String;
    ParameterStr : String;
begin
    
    Result := True;

    // Check if the application is already installed by the old NSIS installer, and uninstall it
    // Look into the different registry entries: win32, win64 and without user rights
    if not RegQueryStringValue(HKLM, 'SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\Betaflight Blackbox Explorer', 'UninstallString', ResultStr) then     
    begin
        if not RegQueryStringValue(HKLM, 'SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\Betaflight Blackbox Explorer', 'UninstallString', ResultStr) then     
        begin
            RegQueryStringValue(HKCU, 'SOFTWARE\Betaflight\Betaflight Blackbox Explorer', 'UninstallString', ResultStr) 
        end;
    end;

    // Found, start uninstall
    if ResultStr <> '' then 
    begin
        
        ResultStr:=RemoveQuotes(ResultStr);

        // Add this parameter to not return until uninstall finished. The drawback is that the uninstaller file is not deleted
        ParameterStr := '_?=' + ExtractFilePath(ResultStr);

        if Exec(ResultStr, ParameterStr, '', SW_SHOW, ewWaitUntilTerminated, ResultCode) then
        begin
          // Delete the unistaller file and empty folders. Not deleting the files.
          DeleteFile(ResultStr);
          DelTree(ExtractFilePath(ResultStr), True, False, True);
        end
        else begin
            Result := False;
            MsgBox('Error uninstalling old Blackbox ' + SysErrorMessage(ResultCode) + '.', mbError, MB_OK);
        end;        
    end;    

end;