
# actually this doesn't work, appearently dd-wrt is pretty old
# Run this in the Administration -> Commands page
# Reboot router to reset, I guess
iptables -t mangle -L -v -n ;
echo Add prerouting rule ;
iptables -I PREROUTING -t mangle -j ROUTE --gw 192.168.0.67 --tee ;
echo Add postrouting rule ;
iptables -I POSTROUTING -t mangle -j ROUTE --gw 192.168.0.67 --tee ;
echo all done ;
iptables -t mangle -L -v -n ;
